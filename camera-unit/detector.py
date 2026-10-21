"""Frame capture plus YOLOv8n person detection.

Two capture sources share one detector:
- Picamera2 on the Raspberry Pi (default).
- An OpenCV webcam on a laptop (--webcam), for testing real detection
  without a Pi.

Imported lazily by main.py so --fake works on any machine. Nothing here
leaves the camera unit except foot points and, when asked, a single JPEG
still for the admin zone editor.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image
from ultralytics import YOLO

from overlay import BOX_COLOR, FOOT_COLOR, draw_people
from status import CameraUnavailable

log = logging.getLogger("camera-unit.detector")

PERSON_CLASS = 0  # COCO class id for "person"


@dataclass
class Person:
    """One detected person: the box and the single point used for counting."""

    box: tuple[float, float, float, float]  # x1, y1, x2, y2 in frame pixels
    confidence: float = 0.0

    @property
    def foot(self) -> tuple[float, float]:
        """Bottom center of the box. This point, and nothing else, decides which zone the person is in."""
        x1, _, x2, y2 = self.box
        return ((x1 + x2) / 2.0, y2)


class PiCamera:
    """Camera Module 3 through Picamera2. Frames come out as BGR numpy arrays."""

    def __init__(self, width: int, height: int) -> None:
        from picamera2 import Picamera2  # apt: python3-picamera2, Pi only

        if not Picamera2.global_camera_info():
            raise CameraUnavailable("no Pi camera found, check the ribbon cable")
        try:
            self.camera = Picamera2()
            # Picamera2's "RGB888" lays pixels out as B, G, R in memory, which is
            # the OpenCV order that Ultralytics expects for numpy input.
            config = self.camera.create_video_configuration(main={"size": (width, height), "format": "RGB888"})
            self.camera.configure(config)
        except Exception as e:  # noqa: BLE001
            raise CameraUnavailable(f"could not open the Pi camera: {e}") from e

    def start(self) -> None:
        try:
            self.camera.start()
        except Exception as e:  # noqa: BLE001
            raise CameraUnavailable(f"could not start the Pi camera: {e}") from e

    def stop(self) -> None:
        try:
            self.camera.stop()
            self.camera.close()
        except Exception as e:  # noqa: BLE001
            log.warning("Pi camera stop failed: %s", e)

    def capture(self):
        try:
            return self.camera.capture_array()
        except Exception as e:  # noqa: BLE001
            raise CameraUnavailable(f"Pi camera returned no frame: {e}") from e


class Webcam:
    """Any webcam through OpenCV (pip: opencv-python). Frames are BGR like Picamera2's."""

    def __init__(self, width: int, height: int, index: int = 0) -> None:
        import cv2  # pip: opencv-python

        self.cv2 = cv2
        self.index = index
        self.width = width
        self.height = height
        self.cap = None

    def start(self) -> None:
        cv2 = self.cv2
        self.cap = cv2.VideoCapture(self.index)
        if not self.cap.isOpened():
            self.stop()
            raise CameraUnavailable(f"could not open webcam {self.index}, check the USB cable or try --webcam-index 1")
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

    def stop(self) -> None:
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def capture(self):
        ok, frame = self.cap.read()
        if not ok:
            raise CameraUnavailable("webcam returned no frame, check the USB cable")
        # Webcams ignore the requested size when they do not support it, so
        # resize: zone polygons are in frame pixels at the configured size.
        if frame.shape[1] != self.width or frame.shape[0] != self.height:
            frame = self.cv2.resize(frame, (self.width, self.height))
        return frame


class Detector:
    def __init__(
        self,
        width: int,
        height: int,
        confidence: float,
        model: str = "yolov8n.pt",
        webcam: bool = False,
        webcam_index: int = 0,
    ) -> None:
        self.width = width
        self.height = height
        self.confidence = confidence
        self.webcam = webcam
        self.webcam_index = webcam_index
        # Fail fast on a missing library, here where main.py reports it.
        if webcam:
            import cv2  # noqa: F401
        else:
            import picamera2  # noqa: F401
        self.model = YOLO(model)
        # Opened in start() so a missing camera can be retried without
        # reloading the model.
        self.camera: PiCamera | Webcam | None = None

    def start(self) -> None:
        """Opens the camera. Raises CameraUnavailable when it is not there."""
        self.stop()
        camera = Webcam(self.width, self.height, self.webcam_index) if self.webcam else PiCamera(self.width, self.height)
        camera.start()
        self.camera = camera
        log.info("%s started at %dx%d", type(camera).__name__, self.width, self.height)

    def stop(self) -> None:
        if self.camera is not None:
            self.camera.stop()
            self.camera = None

    def capture(self):
        return self.camera.capture()

    def detect(self, frame) -> list[Person]:
        """Every person in the frame, box in frame pixels."""
        results = self.model.predict(
            frame,
            classes=[PERSON_CLASS],
            conf=self.confidence,
            imgsz=640,
            verbose=False,
        )
        people: list[Person] = []
        for r in results:
            if r.boxes is None:
                continue
            for (x1, y1, x2, y2), conf in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist()):
                people.append(Person((x1, y1, x2, y2), conf))
        return people

    def foot_points(self, frame) -> list[tuple[float, float]]:
        return [p.foot for p in self.detect(frame)]

    @staticmethod
    def jpeg(frame, people: list[Person] | None = None, quality: int = 70) -> bytes:
        """Encodes a captured frame as JPEG (flipping BGR to RGB for PIL).

        With people given, draws each box and its foot point so staff can see
        in the admin app exactly which point has to land inside a zone.
        """
        image = Image.fromarray(frame[:, :, ::-1])
        if people:
            draw_people(image, people)
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=quality)
        return buf.getvalue()


def draw_people_cv(frame, people: list[Person]) -> None:
    """Same overlay on a BGR numpy frame, for the --show window."""
    import cv2

    h = frame.shape[0]
    for p in people:
        x1, y1, x2, y2 = (int(v) for v in p.box)
        cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR[::-1], 3)
        cv2.putText(frame, f"{p.confidence:.2f}", (x1 + 4, max(18, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, BOX_COLOR[::-1], 2)
        fx, fy = p.foot
        fy = min(int(fy), h - 8)
        cv2.circle(frame, (int(fx), fy), 7, FOOT_COLOR[::-1], -1)
        cv2.circle(frame, (int(fx), fy), 7, (255, 255, 255), 2)
