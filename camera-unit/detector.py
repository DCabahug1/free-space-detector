"""Picamera2 capture plus YOLOv8n person detection.

Imported lazily by main.py so --fake works on any machine. Nothing here
leaves the camera unit except foot points and, when asked, a single JPEG
still for the admin zone editor.
"""

from __future__ import annotations

import io
import logging

from picamera2 import Picamera2
from PIL import Image
from ultralytics import YOLO

log = logging.getLogger("camera-unit.detector")

PERSON_CLASS = 0  # COCO class id for "person"


class Detector:
    def __init__(self, width: int, height: int, confidence: float, model: str = "yolov8n.pt") -> None:
        self.width = width
        self.height = height
        self.confidence = confidence
        self.model = YOLO(model)
        self.camera = Picamera2()
        # Picamera2's "RGB888" lays pixels out as B, G, R in memory, which is
        # the OpenCV order that Ultralytics expects for numpy input.
        config = self.camera.create_video_configuration(main={"size": (width, height), "format": "RGB888"})
        self.camera.configure(config)

    def start(self) -> None:
        self.camera.start()
        log.info("camera started at %dx%d", self.width, self.height)

    def stop(self) -> None:
        self.camera.stop()

    def capture(self):
        return self.camera.capture_array()

    def foot_points(self, frame) -> list[tuple[float, float]]:
        """Bottom center of every person box, in frame pixels."""
        results = self.model.predict(
            frame,
            classes=[PERSON_CLASS],
            conf=self.confidence,
            imgsz=640,
            verbose=False,
        )
        feet: list[tuple[float, float]] = []
        for r in results:
            if r.boxes is None:
                continue
            for x1, y1, x2, y2 in r.boxes.xyxy.tolist():
                feet.append(((x1 + x2) / 2.0, y2))
        return feet

    @staticmethod
    def jpeg(frame, quality: int = 70) -> bytes:
        """Encodes a captured frame as JPEG (flipping BGR to RGB for PIL)."""
        buf = io.BytesIO()
        Image.fromarray(frame[:, :, ::-1]).save(buf, format="JPEG", quality=quality)
        return buf.getvalue()
