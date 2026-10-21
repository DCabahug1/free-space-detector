"""Small monitor attached to the camera unit.

Fullscreen tkinter window with two screens:
  pairing: a QR code plus the 6-digit pair code, until an admin claims the unit.
  live:    per-zone counts, refreshed as the worker thread updates Status.
           A "View camera" button (touch sized) opens a fullscreen popup with
           the live frame, person boxes, and each zone colored by its state.

tkinter must run on the main thread, so main.py starts the capture loop in a
background thread and hands it the shared Status object. Press Escape or q
to quit.
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk

from status import STATE_COLORS, Status, display_count, tile_label, tile_state

log = logging.getLogger("camera-unit.monitor")

BG = "#0f172a"
FG = "#f8fafc"
MUTED = "#94a3b8"
ACCENT = "#38bdf8"


# Font sizes below are designed for a 1280x800 screen and scaled down from
# there, so the same layout fits the Pi's small touchscreen (about 800x480)
# and a full size monitor.
DESIGN_W, DESIGN_H = 1280, 800
COMPACT_BELOW_H = 600  # shorter screens put the QR and pair code side by side


class Monitor:
    def __init__(self, status: Status, refresh_ms: int = 500) -> None:
        self.status = status
        self.refresh_ms = refresh_ms
        self.root = tk.Tk()
        self.root.title("Camera unit")
        self.root.configure(bg=BG)
        self.root.attributes("-fullscreen", True)
        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()
        self.scale = max(0.4, min(1.0, self.screen_w / DESIGN_W, self.screen_h / DESIGN_H))
        self.compact = self.screen_h < COMPACT_BELOW_H
        log.info("monitor %dx%d, scale %.2f, %s layout", self.screen_w, self.screen_h, self.scale,
                 "compact" if self.compact else "tall")
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
        self._header: tk.Label | None = None
        self._preview: tk.Toplevel | None = None
        self._preview_label: tk.Label | None = None
        self._preview_photo = None
        self._preview_shown = None

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
        except tk.TclError:
            return
        self.root.after(self.refresh_ms, self.tick)

    # ----- rendering -----

    def fs(self, size: int) -> int:
        """Font size scaled to the screen."""
        return max(8, round(size * self.scale))

    def pad(self, px: int) -> int:
        return max(2, round(px * self.scale))

    def clear(self) -> None:
        for child in self.frame.winfo_children():
            child.destroy()
        self._row_widgets = []
        self._footer = None
        self._header = None

    def render(self) -> None:
        s = self.status
        if s.mode == "pairing":
            if self._shown_mode != "pairing" or self._shown_code != s.pair_code:
                self.clear()
                self.build_pairing()
                self._shown_mode, self._shown_code = "pairing", s.pair_code
        elif s.mode == "live":
            if self._shown_mode != "live" or len(self._row_widgets) != len(s.rows):
                self.clear()
                self.build_live()
                self._shown_mode = "live"
            self.update_live()
        else:
            if self._shown_mode != "starting":
                self.clear()
                tk.Label(self.frame, text="Starting", font=("Helvetica", self.fs(36)), fg=FG, bg=BG).pack(expand=True)
                self._footer = tk.Label(self.frame, text="", font=("Helvetica", self.fs(16)), fg=MUTED, bg=BG,
                                        wraplength=self.screen_w - 40)
                self._footer.pack(pady=self.pad(20))
                self._shown_mode = "starting"
            if self._footer:
                self._footer.configure(text=s.message)

    def build_pairing(self) -> None:
        if self.compact:
            self.build_pairing_compact()
        else:
            self.build_pairing_tall()

    def build_pairing_tall(self) -> None:
        """QR above the pair code. For screens at least 600 px tall."""
        s = self.status
        # Budget: title + QR + code + help + footer must fit in screen_h.
        qr_px = int(min(self.screen_h * 0.42, self.screen_w * 0.5))
        tk.Label(self.frame, text="Pair this camera unit", font=("Helvetica", self.fs(32), "bold"), fg=FG, bg=BG).pack(
            pady=(self.pad(40), self.pad(10))
        )
        qr = make_qr_photo(s.pair_url, target_px=qr_px)
        if qr is not None:
            self._qr_image = qr
            tk.Label(self.frame, image=qr, bg=BG).pack(pady=self.pad(10))
        tk.Label(self.frame, text=s.pair_code, font=("Courier", self.fs(72), "bold"), fg=ACCENT, bg=BG).pack(pady=self.pad(10))
        tk.Label(
            self.frame,
            text="Scan the code or type it in the admin app under Camera units.",
            font=("Helvetica", self.fs(18)),
            fg=MUTED,
            bg=BG,
            wraplength=int(self.screen_w * 0.8),
        ).pack(pady=(0, self.pad(10)))
        self._footer = tk.Label(self.frame, text=s.message, font=("Helvetica", self.fs(14)), fg=MUTED, bg=BG,
                                wraplength=self.screen_w - 40)
        self._footer.pack(side="bottom", pady=self.pad(20))

    def build_pairing_compact(self) -> None:
        """QR on the left, title, pair code and help on the right. For the Pi touchscreen."""
        s = self.status
        self._footer = tk.Label(self.frame, text=s.message, font=("Helvetica", self.fs(14)), fg=MUTED, bg=BG,
                                wraplength=self.screen_w - 40)
        self._footer.pack(side="bottom", pady=self.pad(8))

        body = tk.Frame(self.frame, bg=BG)
        body.pack(fill="both", expand=True, padx=self.pad(24), pady=self.pad(16))

        footer_h = self.fs(14) * 2 + self.pad(8) * 2
        qr_px = int(min(self.screen_h - footer_h - self.pad(32), self.screen_w * 0.42))
        qr = make_qr_photo(s.pair_url, target_px=qr_px)
        if qr is not None:
            self._qr_image = qr
            tk.Label(body, image=qr, bg=BG).pack(side="left", padx=(0, self.pad(24)))
            right_w = self.screen_w - qr_px - self.pad(24) * 3
        else:
            right_w = self.screen_w - self.pad(24) * 2

        right = tk.Frame(body, bg=BG)
        right.pack(side="left", fill="both", expand=True)
        # Courier glyphs are about 0.6 em wide, 6 digits plus slack must fit in right_w.
        code_size = int(min(self.screen_h * 0.16, right_w / (6 * 0.6 * 1.15)))
        tk.Label(right, text="Pair this camera unit", font=("Helvetica", self.fs(28), "bold"), fg=FG, bg=BG,
                 anchor="w", justify="left", wraplength=right_w).pack(anchor="w", pady=(self.pad(8), self.pad(6)))
        tk.Label(right, text=s.pair_code, font=("Courier", code_size, "bold"), fg=ACCENT, bg=BG, anchor="w").pack(
            anchor="w", pady=self.pad(6)
        )
        tk.Label(
            right,
            text="Scan the code or type it in the admin app under Camera units.",
            font=("Helvetica", self.fs(18)),
            fg=MUTED,
            bg=BG,
            anchor="w",
            justify="left",
            wraplength=right_w,
        ).pack(anchor="w", pady=(self.pad(6), 0))

    def build_live(self) -> None:
        s = self.status
        self._header = tk.Label(self.frame, text=s.room_name or s.unit_name, font=("Helvetica", self.fs(32), "bold"),
                                fg=FG, bg=BG, wraplength=self.screen_w - 40)
        self._header.pack(pady=(self.pad(30), self.pad(10)))
        self._footer = tk.Label(self.frame, text="", font=("Helvetica", self.fs(14)), fg=MUTED, bg=BG,
                                wraplength=self.screen_w - 40)
        self._footer.pack(side="bottom", pady=self.pad(12))
        tk.Button(
            self.frame,
            text="View camera",
            command=self.open_preview,
            font=("Helvetica", self.fs(20), "bold"),
            fg=FG,
            bg="#1e293b",
            activeforeground=FG,
            activebackground="#334155",
            relief="flat",
            padx=self.pad(28),
            pady=self.pad(12),
            cursor="hand2",
        ).pack(side="bottom", pady=(0, self.pad(4)))

        # Shrink rows further when there are more zones than fit at full size.
        header_h = self.fs(32) * 1.6 + self.pad(40)
        footer_h = self.fs(14) * 1.6 + self.pad(24) + self.fs(20) * 1.6 + self.pad(28)
        avail_h = max(50, self.screen_h - header_h - footer_h)
        row_h = self.fs(40) * 1.7 + self.pad(16)
        row_scale = min(1.0, avail_h / (row_h * max(1, len(s.rows))))

        def rfs(size: int) -> int:
            return max(8, round(self.fs(size) * row_scale))

        grid = tk.Frame(self.frame, bg=BG)
        grid.pack(fill="both", expand=True, padx=self.pad(40))
        grid.columnconfigure(0, weight=3)
        grid.columnconfigure(1, weight=1)
        grid.columnconfigure(2, weight=3)
        name_w = int(self.screen_w * 0.4)
        for i, row in enumerate(s.rows):
            name = tk.Label(grid, text=row.name, font=("Helvetica", rfs(26)), fg=FG, bg=BG, anchor="w", wraplength=name_w)
            count = tk.Label(grid, text="0", font=("Courier", rfs(40), "bold"), fg=FG, bg=BG)
            state = tk.Label(grid, text="", font=("Helvetica", rfs(22), "bold"), fg=MUTED, bg=BG, anchor="w")
            name.grid(row=i, column=0, sticky="w", pady=round(self.pad(6) * row_scale))
            count.grid(row=i, column=1, sticky="e", padx=self.pad(20))
            state.grid(row=i, column=2, sticky="w")
            self._row_widgets.append((name, count, state))
        if not s.rows:
            tk.Label(grid, text="No zones yet. Draw some in the admin app.", font=("Helvetica", self.fs(22)),
                     fg=MUTED, bg=BG, wraplength=self.screen_w - 80).pack(expand=True)

    def update_live(self) -> None:
        s = self.status
        if self._header:
            self._header.configure(text=s.room_name or s.unit_name)
        for (name, count, state), row in zip(self._row_widgets, s.rows):
            st = tile_state(row.type, row.count, row.capacity)
            cap = f" / {row.capacity}" if row.capacity else ""
            name.configure(text=row.name)
            count.configure(text=f"{display_count(row.type, row.count, row.capacity)}{cap}")
            state.configure(text=tile_label(st, row.count), fg=STATE_COLORS[st])
        if self._footer:
            self._footer.configure(text=s.message)

    # ----- camera preview popup -----

    PREVIEW_REFRESH_MS = 150

    def open_preview(self) -> None:
        if self._preview is not None:
            return
        self.status.preview = None
        self.status.preview_open.set()
        top = tk.Toplevel(self.root, bg="black")
        top.title("Camera")
        top.attributes("-fullscreen", True)
        top.protocol("WM_DELETE_WINDOW", self.close_preview)
        top.bind("<Escape>", lambda _e: self.close_preview())
        top.bind("q", lambda _e: self.close_preview())
        self._preview = top

        tk.Button(
            top,
            text="Close",
            command=self.close_preview,
            font=("Helvetica", self.fs(20), "bold"),
            fg=FG,
            bg="#1e293b",
            activeforeground=FG,
            activebackground="#334155",
            relief="flat",
            padx=self.pad(28),
            pady=self.pad(10),
            cursor="hand2",
        ).pack(side="bottom", pady=self.pad(6))
        label = tk.Label(top, text="Waiting for the camera", font=("Helvetica", self.fs(24)), fg=MUTED, bg="black")
        label.pack(fill="both", expand=True)
        # Tapping the picture closes it too, so the button is not the only way out.
        label.bind("<Button-1>", lambda _e: self.close_preview())
        self._preview_label = label
        self._preview_shown = None
        top.after(self.PREVIEW_REFRESH_MS, self.preview_tick)

    def close_preview(self) -> None:
        self.status.preview_open.clear()
        self.status.preview = None
        top, self._preview = self._preview, None
        self._preview_label = None
        self._preview_photo = None
        self._preview_shown = None
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
        image = self.status.preview
        if image is not None and image is not self._preview_shown:
            try:
                from PIL import ImageTk

                # The popup is fullscreen, so size against the screen rather
                # than winfo_width, which reads 1 until the window is mapped.
                box_w = self.screen_w
                box_h = max(1, self.screen_h - self.fs(20) * 2 - self.pad(26))
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


def qr_box_size(modules: int, target_px: int, border: int = 2) -> int:
    """Largest whole pixel size per module that keeps the QR within target_px."""
    return max(2, target_px // (modules + 2 * border))


def make_qr_photo(url: str, target_px: int = 300):
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
    border = 2
    qr = qrcode.QRCode(border=border)
    qr.add_data(url)
    qr.make(fit=True)
    qr.box_size = qr_box_size(qr.modules_count, target_px, border)
    img = qr.make_image(fill_color="black", back_color="white").get_image()
    return ImageTk.PhotoImage(img)
