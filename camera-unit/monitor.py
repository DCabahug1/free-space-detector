"""Small monitor attached to the camera unit.

Fullscreen tkinter window with two screens:
  pairing: a QR code plus the 6-digit pair code, until an admin claims the unit.
  live:    per-zone counts, refreshed as the worker thread updates Status.

tkinter must run on the main thread, so main.py starts the capture loop in a
background thread and hands it the shared Status object. Press Escape or q
to quit.
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk

from status import STATE_COLORS, Status, tile_label, tile_state

log = logging.getLogger("camera-unit.monitor")

BG = "#0f172a"
FG = "#f8fafc"
MUTED = "#94a3b8"
ACCENT = "#38bdf8"


class Monitor:
    def __init__(self, status: Status, refresh_ms: int = 500) -> None:
        self.status = status
        self.refresh_ms = refresh_ms
        self.root = tk.Tk()
        self.root.title("Camera unit")
        self.root.configure(bg=BG)
        self.root.attributes("-fullscreen", True)
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

    # ----- lifecycle -----

    def run(self, worker: threading.Thread) -> None:
        worker.start()
        self.root.after(self.refresh_ms, self.tick)
        self.root.mainloop()
        self.status.stop.set()

    def quit(self) -> None:
        self.status.stop.set()
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
                tk.Label(self.frame, text="Starting", font=("Helvetica", 36), fg=FG, bg=BG).pack(expand=True)
                self._footer = tk.Label(self.frame, text="", font=("Helvetica", 16), fg=MUTED, bg=BG)
                self._footer.pack(pady=20)
                self._shown_mode = "starting"
            if self._footer:
                self._footer.configure(text=s.message)

    def build_pairing(self) -> None:
        s = self.status
        tk.Label(self.frame, text="Pair this camera unit", font=("Helvetica", 32, "bold"), fg=FG, bg=BG).pack(pady=(40, 10))
        qr = make_qr_photo(s.pair_url, box_size=8)
        if qr is not None:
            self._qr_image = qr
            tk.Label(self.frame, image=qr, bg=BG).pack(pady=10)
        tk.Label(self.frame, text=s.pair_code, font=("Courier", 72, "bold"), fg=ACCENT, bg=BG).pack(pady=10)
        tk.Label(
            self.frame,
            text="Scan the code or type it in the admin app under Camera units.",
            font=("Helvetica", 18),
            fg=MUTED,
            bg=BG,
            wraplength=700,
        ).pack(pady=(0, 10))
        self._footer = tk.Label(self.frame, text=s.message, font=("Helvetica", 14), fg=MUTED, bg=BG)
        self._footer.pack(side="bottom", pady=20)

    def build_live(self) -> None:
        s = self.status
        self._header = tk.Label(self.frame, text=s.room_name or s.unit_name, font=("Helvetica", 32, "bold"), fg=FG, bg=BG)
        self._header.pack(pady=(30, 10))
        grid = tk.Frame(self.frame, bg=BG)
        grid.pack(fill="both", expand=True, padx=40)
        grid.columnconfigure(0, weight=3)
        grid.columnconfigure(1, weight=1)
        grid.columnconfigure(2, weight=3)
        for i, row in enumerate(s.rows):
            name = tk.Label(grid, text=row.name, font=("Helvetica", 26), fg=FG, bg=BG, anchor="w")
            count = tk.Label(grid, text="0", font=("Courier", 40, "bold"), fg=FG, bg=BG)
            state = tk.Label(grid, text="", font=("Helvetica", 22, "bold"), fg=MUTED, bg=BG, anchor="w")
            name.grid(row=i, column=0, sticky="w", pady=6)
            count.grid(row=i, column=1, sticky="e", padx=20)
            state.grid(row=i, column=2, sticky="w")
            self._row_widgets.append((name, count, state))
        if not s.rows:
            tk.Label(grid, text="No zones yet. Draw some in the admin app.", font=("Helvetica", 22), fg=MUTED, bg=BG).pack(expand=True)
        self._footer = tk.Label(self.frame, text="", font=("Helvetica", 14), fg=MUTED, bg=BG)
        self._footer.pack(side="bottom", pady=20)

    def update_live(self) -> None:
        s = self.status
        if self._header:
            self._header.configure(text=s.room_name or s.unit_name)
        for (name, count, state), row in zip(self._row_widgets, s.rows):
            st = tile_state(row.type, row.count, row.capacity)
            cap = f" / {row.capacity}" if row.capacity else ""
            name.configure(text=row.name)
            count.configure(text=f"{row.count}{cap}")
            state.configure(text=tile_label(st, row.count), fg=STATE_COLORS[st])
        if self._footer:
            self._footer.configure(text=s.message)


def make_qr_photo(url: str, box_size: int = 8):
    """Returns a tkinter PhotoImage of the QR code, or None if qrcode or PIL is missing."""
    if not url:
        return None
    try:
        import qrcode
        from PIL import ImageTk
    except ImportError:
        log.warning("qrcode or Pillow not installed, showing the pair code only")
        return None
    qr = qrcode.QRCode(box_size=box_size, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").get_image()
    return ImageTk.PhotoImage(img)
