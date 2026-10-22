"""Small monitor attached to the camera unit.

Fullscreen tkinter window, designed at 800x480 and scaled up to 1280x800:
  starting: "Spot" and a status line while Wi-Fi and the server come up.
  pairing:  a QR code plus the 6-digit pair code, until an admin claims the unit.
  live:     one row per zone (name, count, state), a status line, and the
            View camera, Refresh zones and Settings buttons. Settings holds
            Check for updates, Reboot and Power off.
            View camera opens a fullscreen overlay with the live frame, person
            boxes, foot dots, and each zone colored by its state.

tkinter must run on the main thread, so main.py starts the capture loop in a
background thread and hands it the shared Status object. Press Escape or q
to quit.
"""

from __future__ import annotations

import logging
import threading
import time
import tkinter as tk
import tkinter.font as tkfont

import power
from status import ACCENT, BAND, BAND_2, BAND_FG, BAND_MUTED, BG, BUTTON_ACTIVE, BUTTON_BG, FG, MUTED, STATE_COLORS, Status, count_text, tile_label, tile_state

log = logging.getLogger("camera-unit.monitor")

PAPER = "#faf9f5"
DIM = "#75706a"  # rows at 50 % while updating
SHARED = STATE_COLORS["shared"]

DESIGN_W, DESIGN_H = 800, 480
QR_PX = 220
ROW_H = 52
BUTTON_H = 52
BUTTON_MIN_W = 140

SANS_CANDIDATES = ("IBM Plex Sans", "DejaVu Sans", "Helvetica")
MONO_CANDIDATES = ("JetBrains Mono", "DejaVu Sans Mono", "Courier")


class Monitor:
    def __init__(self, status: Status, refresh_ms: int = 500) -> None:
        self.status = status
        self.refresh_ms = refresh_ms
        self.root = tk.Tk()
        self.root.title("Spot camera unit")
        self.root.configure(bg=BG)
        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()
        self.make_fullscreen(self.root)
        self.scale = max(0.6, min(2.0, self.screen_w / DESIGN_W, self.screen_h / DESIGN_H))
        # Tall screens stack the QR above the code.
        self.stacked = self.screen_h > self.screen_w * 0.8
        families = set(tkfont.families())
        self.sans = next((f for f in SANS_CANDIDATES if f in families), "Helvetica")
        self.mono = next((f for f in MONO_CANDIDATES if f in families), "Courier")
        log.info("monitor %dx%d, scale %.2f, fonts %s / %s", self.screen_w, self.screen_h, self.scale, self.sans, self.mono)
        self.root.bind("<Escape>", lambda _e: self.quit())
        self.root.bind("q", lambda _e: self.quit())
        self.root.protocol("WM_DELETE_WINDOW", self.quit)

        self.frame = tk.Frame(self.root, bg=BG)
        self.frame.pack(fill="both", expand=True)
        self._shown_mode = ""
        self._shown_code = ""
        self._qr_image = None
        self._row_widgets: list[tuple[tk.Label, tk.Label, tk.Label]] = []
        self._footer: tk.Label | None = None
        self._unit: tk.Label | None = None
        self._buttons: list[tk.Button] = []
        self._update_button: tk.Button | None = None
        self._settings: tk.Frame | None = None
        self._settings_buttons: list[tk.Button] = []
        self._settings_footer: tk.Label | None = None
        self._sharing_button: tk.Button | None = None
        self._confirm: tk.Frame | None = None
        self._preview: tk.Frame | None = None
        self._preview_label: tk.Label | None = None
        self._preview_status: tk.Label | None = None
        self._preview_photo = None
        self._preview_shown = None
        self._updating = False

    # ----- lifecycle -----

    def run(self, worker: threading.Thread) -> None:
        worker.start()
        self.root.after(self.refresh_ms, self.tick)
        self.root.mainloop()
        self.status.stop.set()

    def quit(self) -> None:
        self.status.stop.set()
        self.status.preview_open.clear()
        self.root.destroy()

    def tick(self) -> None:
        if self.status.stop.is_set():
            self.root.destroy()
            return
        try:
            self.render()
            if self.status.update_requested.is_set():
                self.status.update_requested.clear()
                if not self._updating:
                    self.start_update()
        except tk.TclError:
            return
        self.root.after(self.refresh_ms, self.tick)

    # ----- helpers -----

    def fs(self, size: int) -> int:
        """Font size scaled to the screen."""
        return max(8, round(size * self.scale))

    def px(self, n: int) -> int:
        return max(1, round(n * self.scale))

    def font(self, size: int, weight: str = "normal", mono: bool = False) -> tuple:
        return (self.mono if mono else self.sans, self.fs(size), weight)

    def clear(self) -> None:
        for child in self.frame.winfo_children():
            child.destroy()
        self._row_widgets = []
        self._footer = None
        self._unit = None
        self._buttons = []
        self._update_button = None

    def button(self, parent: tk.Misc, text: str, command) -> tk.Button:
        """Touch sized button, 52 px tall, at least 140 px wide, packed left to right."""
        b = tk.Button(
            parent,
            text=text,
            command=command,
            font=self.font(18, "bold"),
            fg=FG,
            bg=BUTTON_BG,
            activeforeground=FG,
            activebackground=BUTTON_ACTIVE,
            disabledforeground=MUTED,
            relief="flat",
            borderwidth=0,
            highlightthickness=0,
            padx=self.px(20),
            cursor="hand2",
        )
        b.pack(side="left", padx=(0, self.px(8)), ipady=max(0, (self.px(BUTTON_H) - self.fs(18) * 2) // 2))
        b.configure(width=max(1, round(BUTTON_MIN_W / (self.fs(18) * 0.55))))
        self._buttons.append(b)
        return b

    def grid_button(self, parent: tk.Misc, text: str, command, row: int, col: int) -> tk.Button:
        """Like button(), but placed in a grid cell and stretched to fill it."""
        b = tk.Button(
            parent,
            text=text,
            command=command,
            font=self.font(18, "bold"),
            fg=FG,
            bg=BUTTON_BG,
            activeforeground=FG,
            activebackground=BUTTON_ACTIVE,
            disabledforeground=MUTED,
            relief="flat",
            borderwidth=0,
            highlightthickness=0,
            padx=self.px(8),
            cursor="hand2",
        )
        b.grid(row=row, column=col, sticky="ew", padx=(0, self.px(8)), pady=(0, self.px(8)),
               ipady=max(0, (self.px(BUTTON_H) - self.fs(18) * 2) // 2))
        self._buttons.append(b)
        return b

    def footer_text(self) -> str:
        s = self.status
        if s.message:
            return s.message
        if not s.sharing.is_set():
            return "Sharing paused. Counts stay on this screen."
        if s.mode == "live":
            if s.posted_at:
                ago = max(0, round(time.time() - s.posted_at))
                return f"Posted {ago} s ago. Wi-Fi ok."
            return "Waiting for the first post."
        return ""

    # ----- rendering -----

    def render(self) -> None:
        s = self.status
        if s.mode == "pairing":
            if self._shown_mode != "pairing" or self._shown_code != s.pair_code:
                self.clear()
                self.build_pairing()
                self._shown_mode, self._shown_code = "pairing", s.pair_code
            if self._footer:
                self._footer.configure(text=self.footer_text())
        elif s.mode == "live":
            if self._shown_mode != "live" or len(self._row_widgets) != len(s.rows):
                self.clear()
                self.build_live()
                self._shown_mode = "live"
            self.update_live()
        else:
            if self._shown_mode != "starting":
                self.clear()
                tk.Label(self.frame, text="Spot", font=self.font(40, "bold"), fg=ACCENT, bg=BG).pack(expand=True)
                self._footer = tk.Label(self.frame, text="", font=self.font(20), fg=MUTED, bg=BG,
                                        wraplength=self.screen_w - self.px(48))
                self._footer.pack(pady=(0, self.px(48)))
                self._shown_mode = "starting"
            if self._footer:
                self._footer.configure(text=s.message or "Starting. Connecting to Wi-Fi")

    def build_pairing(self) -> None:
        s = self.status
        pad = self.px(24)
        band = tk.Frame(self.frame, bg=BAND)
        band.pack(fill="x", pady=(0, self.px(12)))
        tk.Label(band, text="Pair this camera unit", font=self.font(28, "bold"), fg=BAND_FG, bg=BAND,
                 anchor="w").pack(fill="x", padx=pad, pady=self.px(18))

        # Footer first so it claims the bottom edge: status left, Settings right.
        footer = tk.Frame(self.frame, bg=BG)
        footer.pack(side="bottom", fill="x", padx=pad, pady=(0, self.px(16)))
        buttons = tk.Frame(footer, bg=BG)
        buttons.pack(side="right")
        self.button(buttons, "Settings", self.open_settings)
        self._footer = tk.Label(footer, text=self.footer_text(), font=self.font(16), fg=MUTED, bg=BG,
                                anchor="w", justify="left", wraplength=int(self.screen_w * 0.6))
        self._footer.pack(side="left", fill="x", expand=True)

        body = tk.Frame(self.frame, bg=BG)
        body.pack(fill="both", expand=True, padx=pad)

        qr_px = self.px(QR_PX)
        qr = make_qr_photo(s.pair_url, target_px=qr_px - self.px(24))
        paper = tk.Frame(body, bg=PAPER, width=qr_px, height=qr_px)
        paper.pack_propagate(False)
        if qr is not None:
            self._qr_image = qr
            tk.Label(paper, image=qr, bg=PAPER).pack(expand=True)

        right = tk.Frame(body, bg=BG)
        code = spaced_code(s.pair_code)
        tk.Label(right, text=code, font=self.font(72, "bold", mono=True), fg=ACCENT, bg=BG, anchor="w").pack(anchor="w")
        tk.Label(
            right,
            text="Scan, or type the code in the admin app under Camera units.",
            font=self.font(16),
            fg=MUTED,
            bg=BG,
            anchor="w",
            justify="left",
            wraplength=int(self.screen_w - qr_px - pad * 3) if not self.stacked else self.screen_w - pad * 2,
        ).pack(anchor="w", pady=(self.px(8), 0))

        if self.stacked:
            paper.pack(anchor="w", pady=(0, self.px(16)))
            right.pack(anchor="w", fill="x")
        else:
            paper.pack(side="left", anchor="n", padx=(0, pad))
            right.pack(side="left", anchor="n", fill="both", expand=True, pady=(self.px(4), 0))

    def build_live(self) -> None:
        s = self.status
        pad = self.px(24)
        band = tk.Frame(self.frame, bg=BAND)
        band.pack(fill="x", pady=(0, self.px(8)))
        header = tk.Frame(band, bg=BAND)
        header.pack(fill="x", padx=pad, pady=self.px(16))
        # Just the unit name. The building and area are on the Settings screen.
        self._unit = tk.Label(header, text=s.unit_name, font=self.font(26, "bold"), fg=BAND_FG, bg=BAND, anchor="w")
        self._unit.pack(side="left", fill="x", expand=True)

        bottom = tk.Frame(self.frame, bg=BG)
        bottom.pack(side="bottom", fill="x", padx=pad, pady=(self.px(8), self.px(16)))
        buttons = tk.Frame(bottom, bg=BG)
        buttons.pack(side="right")
        self.button(buttons, "View camera", self.open_preview)
        self.button(buttons, "Refresh zones", self.refresh_zones)
        self.button(buttons, "Settings", self.open_settings)
        self._footer = tk.Label(bottom, text="", font=self.font(16), fg=MUTED, bg=BG, anchor="w",
                                justify="left", wraplength=int(self.screen_w * 0.45))
        self._footer.pack(side="left", fill="x", expand=True)

        grid = tk.Frame(self.frame, bg=BG)
        grid.pack(fill="both", expand=True, padx=pad)
        if not s.rows:
            tk.Label(grid, text="No zones yet", font=self.font(26, "bold"), fg=FG, bg=BG).pack(anchor="w", pady=(self.px(24), 0))
            tk.Label(grid, text="Draw them in the admin app. This screen updates on its own.", font=self.font(16),
                     fg=MUTED, bg=BG, wraplength=self.screen_w - pad * 2, justify="left").pack(anchor="w")
            return

        # Rows are 52 px and shrink together when there are more than fit.
        header_h = self.fs(26) * 1.8 + self.px(40)
        bottom_h = self.px(BUTTON_H) + self.px(32)
        avail = max(60, self.screen_h - header_h - bottom_h)
        row_scale = min(1.0, avail / (self.px(ROW_H) * len(s.rows)))

        def rf(size: int, weight: str = "normal", mono: bool = False) -> tuple:
            return (self.mono if mono else self.sans, max(8, round(self.fs(size) * row_scale)), weight)

        grid.columnconfigure(0, weight=3)
        grid.columnconfigure(1, weight=0)
        grid.columnconfigure(2, weight=2)
        for i, row in enumerate(s.rows):
            name = tk.Label(grid, text=row.name, font=rf(22), fg=FG, bg=BG, anchor="w")
            count = tk.Label(grid, text="", font=rf(38, "bold", mono=True), fg=FG, bg=BG, anchor="e")
            state = tk.Label(grid, text="", font=rf(22), fg=MUTED, bg=BG, anchor="w")
            pady = max(0, round((self.px(ROW_H) * row_scale - self.fs(38) * row_scale * 1.3) / 2))
            name.grid(row=i, column=0, sticky="w", pady=pady)
            count.grid(row=i, column=1, sticky="e", padx=self.px(24))
            state.grid(row=i, column=2, sticky="w")
            self._row_widgets.append((name, count, state))

    def update_live(self) -> None:
        s = self.status
        if self._unit is not None:
            self._unit.configure(text=s.unit_name)
        for (name, count, state), row in zip(self._row_widgets, s.rows):
            st = tile_state(row.type, row.count, row.capacity)
            color = DIM if self._updating else STATE_COLORS[st]
            name.configure(text=row.name, fg=DIM if self._updating else FG)
            count.configure(text=count_text(row.type, row.count, row.capacity), fg=color)
            state.configure(text=tile_label(st), fg=color)
        if self._footer:
            paused = not s.sharing.is_set()
            self._footer.configure(text=self.footer_text(), fg=SHARED if self._updating or paused else MUTED)

    def say(self, text: str) -> None:
        """Footer text. Call on the tk thread."""
        self.status.message = text
        for label in (self._footer, self._settings_footer):
            if label:
                try:
                    label.configure(text=text)
                except tk.TclError:
                    pass

    # ----- actions -----

    def start_update(self) -> None:
        """Pull the latest code in the background, then restart the unit if
        anything changed. The worker keeps counting meanwhile."""
        if self._updating:
            return
        self._updating = True
        for b in self._buttons + self._settings_buttons:
            b.configure(state="disabled")
        if self._update_button:
            self._update_button.configure(text="Updating")
        for label in (self._footer, self._settings_footer):
            if label:
                label.configure(fg=SHARED)
        self.say("Checking for updates")

        def work() -> None:
            from updater import update

            result = update(progress=lambda text: self.root.after(0, self.say, text))
            self.root.after(0, self.finish_update, result)

        threading.Thread(target=work, daemon=True).start()

    def finish_update(self, result) -> None:
        self._updating = False
        log.info("update: %s", result.message)
        self.say(result.message)
        if result.ok and result.updated:
            self.status.restart.set()
            self.root.after(1500, self.quit)
            return
        try:
            for b in self._buttons + self._settings_buttons:
                b.configure(state="normal")
            if self._update_button:
                self._update_button.configure(text="Check for updates")
            for label in (self._footer, self._settings_footer):
                if label:
                    label.configure(fg=MUTED)
        except tk.TclError:
            pass
        # Keep the result on screen for a moment, then go back to the post status.
        self.root.after(4000, lambda: self.say("") if self.status.message == result.message else None)

    def refresh_zones(self) -> None:
        """Ask the worker to re-fetch zones now, after an admin edits them in the web app."""
        self.status.refresh_zones.set()
        self.say("Refreshing zones")


    # ----- settings screen -----

    def open_settings(self) -> None:
        """Fullscreen overlay: Check for updates, Refresh zones, Pause sharing,
        Reboot, Power off, Quit."""
        if self._settings is not None:
            return
        pad = self.px(24)
        top = tk.Frame(self.root, bg=BG)
        top.place(x=0, y=0, relwidth=1, relheight=1)
        top.lift()
        self._settings = top
        self._settings_buttons = []

        band = tk.Frame(top, bg=BAND)
        band.pack(fill="x", pady=(0, self.px(12)))
        header = tk.Frame(band, bg=BAND)
        header.pack(fill="x", padx=pad, pady=self.px(12))
        tk.Label(header, text="Settings", font=self.font(28, "bold"), fg=BAND_FG, bg=BAND, anchor="w").pack(side="left")
        close_row = tk.Frame(header, bg=BAND)
        close_row.pack(side="right")
        saved = self._buttons
        self._buttons = self._settings_buttons
        close = self.button(close_row, "Close", self.close_settings)
        close.configure(fg=BAND_FG, activeforeground=BAND_FG, bg=BAND_2, activebackground=BAND_2)

        s = self.status
        facts = tk.Frame(top, bg=BG)
        facts.pack(fill="x", padx=pad, pady=(0, self.px(16)))
        for label, value in (
            ("Camera unit", s.unit_name or "Not paired"),
            ("Area", f"{s.building_name}, {s.room_name}" if s.room_name else "Not paired"),
            ("Server", s.server_url),
            ("Version", s.version or "unknown"),
            ("Last updated", s.version_time or "unknown"),
        ):
            row = tk.Frame(facts, bg=BG)
            row.pack(fill="x", pady=self.px(2))
            tk.Label(row, text=label, font=self.font(16), fg=MUTED, bg=BG, anchor="w", width=12).pack(side="left")
            tk.Label(row, text=value, font=self.font(16), fg=FG, bg=BG, anchor="w").pack(side="left", fill="x", expand=True)

        # A three column grid that shares the width evenly, so every button
        # fits on the 800 px screen and grows with larger ones.
        actions = tk.Frame(top, bg=BG)
        actions.pack(fill="x", padx=pad)
        for col in range(3):
            actions.columnconfigure(col, weight=1, uniform="actions")
        cells = [
            ("Updating" if self._updating else "Check for updates", self.start_update),
            ("Refresh zones", self.refresh_zones),
            ("Resume sharing" if not s.sharing.is_set() else "Pause sharing", self.toggle_sharing),
            ("Reboot", lambda: self.confirm("Reboot the camera unit?", "It is back in about a minute.",
                                            "Reboot", self.do_reboot)),
            ("Power off", lambda: self.confirm("Power off the camera unit?",
                                               "Unplug it after the screen goes dark.", "Power off",
                                               self.do_poweroff)),
            ("Quit", lambda: self.confirm("Quit the camera unit?",
                                          "It stops counting until the Camera unit desktop shortcut or a reboot starts it again.",
                                          "Quit", self.do_quit)),
        ]
        made = []
        for i, (text, command) in enumerate(cells):
            b = self.grid_button(actions, text, command, row=i // 3, col=i % 3)
            made.append(b)
        self._update_button, _, self._sharing_button = made[0], made[1], made[2]
        self._buttons = saved
        if self._updating:
            for b in self._settings_buttons:
                b.configure(state="disabled")

        self._settings_footer = tk.Label(top, text=self.footer_text(), font=self.font(16),
                                         fg=SHARED if self._updating else MUTED, bg=BG, anchor="w", justify="left",
                                         wraplength=self.screen_w - pad * 2)
        self._settings_footer.pack(side="bottom", fill="x", padx=pad, pady=(0, self.px(16)))

    def toggle_sharing(self) -> None:
        """Pause or resume posting counts and frames. The unit keeps counting."""
        s = self.status
        if s.sharing.is_set():
            s.sharing.clear()
            text = "Resume sharing"
        else:
            s.sharing.set()
            text = "Pause sharing"
        s.resync.set()
        if self._sharing_button is not None:
            try:
                self._sharing_button.configure(text=text)
            except tk.TclError:
                pass
        self.say("")

    def close_settings(self) -> None:
        top, self._settings = self._settings, None
        self._settings_buttons = []
        self._settings_footer = None
        self._sharing_button = None
        self._update_button = None
        self._confirm = None
        if top is not None:
            try:
                top.destroy()
            except tk.TclError:
                pass

    def confirm(self, question: str, detail: str, action: str, run) -> None:
        """A prompt over the settings screen: Cancel, or the named action."""
        if self._settings is None or self._confirm is not None:
            return
        pad = self.px(24)
        box = tk.Frame(self._settings, bg=BUTTON_BG)
        box.place(relx=0.5, rely=0.5, anchor="center")
        self._confirm = box
        inner = tk.Frame(box, bg=BUTTON_BG)
        inner.pack(padx=pad, pady=pad)
        tk.Label(inner, text=question, font=self.font(24, "bold"), fg=FG, bg=BUTTON_BG, anchor="w").pack(anchor="w")
        tk.Label(inner, text=detail, font=self.font(16), fg=MUTED, bg=BUTTON_BG, anchor="w",
                 wraplength=int(self.screen_w * 0.6)).pack(anchor="w", pady=(self.px(4), self.px(16)))
        row = tk.Frame(inner, bg=BUTTON_BG)
        row.pack(anchor="e")
        saved = self._buttons
        self._buttons = []
        cancel = self.button(row, "Cancel", self.close_confirm)
        cancel.configure(bg=BUTTON_ACTIVE)
        go = self.button(row, action, lambda: (self.close_confirm(), run()))
        go.configure(fg="#ffffff", activeforeground="#ffffff", bg=STATE_COLORS["full"], activebackground=STATE_COLORS["full"])
        self._buttons = saved

    def close_confirm(self) -> None:
        box, self._confirm = self._confirm, None
        if box is not None:
            try:
                box.destroy()
            except tk.TclError:
                pass

    def do_reboot(self) -> None:
        self.power("Rebooting", power.reboot)

    def do_poweroff(self) -> None:
        self.power("Powering off", power.poweroff)

    def do_quit(self) -> None:
        """Ends the program. Under systemd that means stopping the service, or
        Restart=always would bring it straight back."""
        if power.under_systemd():
            self.power("Quitting", power.stop_service)
        else:
            self.quit()

    def power(self, verb: str, run) -> None:
        for b in self._settings_buttons:
            b.configure(state="disabled")
        self.say(verb)

        def work() -> None:
            error = run()
            if error is None:
                self.status.stop.set()
                return
            self.root.after(0, self.power_failed, error)

        threading.Thread(target=work, daemon=True).start()

    def power_failed(self, error: str) -> None:
        self.say(f"Could not do that. {error}")
        for b in self._settings_buttons:
            try:
                b.configure(state="normal")
            except tk.TclError:
                pass

    # ----- camera preview popup -----

    PREVIEW_REFRESH_MS = 150

    def make_fullscreen(self, win: tk.Misc) -> None:
        """Cover the whole screen. labwc (the Pi's Wayland compositor, which runs
        Tk through XWayland) ignores fullscreen requested before the window is
        mapped, so size it to the screen first and request fullscreen again once
        it is up."""
        win.geometry(f"{self.screen_w}x{self.screen_h}+0+0")
        win.attributes("-fullscreen", True)

        def reassert() -> None:
            if win.winfo_exists():
                win.attributes("-fullscreen", False)
                win.attributes("-fullscreen", True)

        win.after(500, reassert)

    def open_preview(self) -> None:
        if self._preview is not None:
            return
        self.status.preview = None
        self.status.preview_open.set()
        # An overlay inside the main window rather than a second Toplevel: under
        # labwc/XWayland a second fullscreen window can be drawn on top while
        # touches still go to the window underneath, so its buttons never fire.
        top = tk.Frame(self.root, bg="black")
        top.place(x=0, y=0, relwidth=1, relheight=1)
        top.lift()
        self.root.bind("<Escape>", lambda _e: self.close_preview())
        self.root.bind("q", lambda _e: self.close_preview())
        self._preview = top

        bar = tk.Frame(top, bg="black")
        bar.pack(side="top", fill="x", padx=self.px(12), pady=self.px(8))
        right = tk.Frame(bar, bg="black")
        right.pack(side="right")
        saved = self._buttons
        self._buttons = []
        self.button(right, "Refresh zones", self.refresh_zones)
        self.button(right, "Close", self.close_preview)
        self._buttons = saved

        strip = tk.Frame(top, bg="black")
        strip.pack(side="bottom", fill="x", padx=self.px(16), pady=self.px(8))
        tk.Label(strip, text="Tap the picture to close", font=self.font(14), fg=MUTED, bg="black").pack(side="left")
        self._preview_status = tk.Label(strip, text="", font=self.font(14), fg=MUTED, bg="black")
        self._preview_status.pack(side="right")

        label = tk.Label(top, text="Waiting for the camera", font=self.font(22), fg=MUTED, bg="black")
        label.pack(fill="both", expand=True)
        label.bind("<Button-1>", lambda _e: self.close_preview())
        self._preview_label = label
        self._preview_shown = None
        top.after(self.PREVIEW_REFRESH_MS, self.preview_tick)

    def close_preview(self) -> None:
        self.status.preview_open.clear()
        self.status.preview = None
        top, self._preview = self._preview, None
        self._preview_label = None
        self._preview_status = None
        self._preview_photo = None
        self._preview_shown = None
        self.root.bind("<Escape>", lambda _e: self.quit())
        self.root.bind("q", lambda _e: self.quit())
        if top is not None:
            try:
                top.destroy()
            except tk.TclError:
                pass

    def preview_tick(self) -> None:
        top, label = self._preview, self._preview_label
        if top is None or label is None:
            return
        if self.status.stop.is_set():
            self.close_preview()
            return
        s = self.status
        if self._preview_status is not None:
            ago = max(0, round(time.time() - s.frame_at)) if s.frame_at else None
            people = f"{s.people} {'person' if s.people == 1 else 'people'}"
            self._preview_status.configure(text=f"{people}, {ago} s ago" if ago is not None else people)
        image = s.preview
        if image is not None and image is not self._preview_shown:
            try:
                from PIL import ImageTk

                box_w = self.screen_w
                box_h = max(1, self.screen_h - self.px(BUTTON_H) - self.fs(14) * 2 - self.px(40))
                scale = min(box_w / image.width, box_h / image.height)
                size = (max(1, int(image.width * scale)), max(1, int(image.height * scale)))
                photo = ImageTk.PhotoImage(image.resize(size))
                label.configure(image=photo, text="")
                self._preview_photo = photo  # keep a reference or tk drops it
                self._preview_shown = image
            except ImportError:
                label.configure(text="Pillow is missing, cannot show the camera")
            except tk.TclError:
                return
        top.after(self.PREVIEW_REFRESH_MS, self.preview_tick)


def spaced_code(code: str) -> str:
    """"482913" -> "482 913"."""
    code = (code or "").replace(" ", "")
    if len(code) == 6:
        return f"{code[:3]} {code[3:]}"
    return code


def qr_box_size(modules: int, target_px: int, border: int = 2) -> int:
    """Largest whole pixel size per module that keeps the QR within target_px."""
    return max(2, target_px // (modules + 2 * border))


def make_qr_photo(url: str, target_px: int = 200):
    """Returns a tkinter PhotoImage of the QR code no larger than target_px on a
    side, or None if qrcode or PIL is missing."""
    if not url:
        return None
    try:
        import qrcode
        from PIL import ImageTk
    except ImportError:
        log.warning("qrcode or Pillow not installed, showing the pair code only")
        return None
    border = 1
    qr = qrcode.QRCode(border=border)
    qr.add_data(url)
    qr.make(fit=True)
    qr.box_size = qr_box_size(qr.modules_count, target_px, border)
    img = qr.make_image(fill_color="#1f1c18", back_color=PAPER).get_image()
    return ImageTk.PhotoImage(img)
