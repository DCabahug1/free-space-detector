"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QrScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called once with the 6 digits found in a QR code.
  onCode: (code: string) => void;
}

// Reads the pair code QR on a camera unit's screen through the phone camera.
// The QR holds only the 6 digits; an older QR that carries a link still
// works since the digits are picked out of whatever text it decodes to.
// Needs a secure page (https or localhost) for the camera.
export function QrScanner({ open, onOpenChange, onCode }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera here. Type the code instead.");
        return;
      }
      const jsQR = (await import("jsqr")).default;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("Camera access was refused. Type the code instead.");
        return;
      }
      if (done) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const scan = () => {
        if (done) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && ctx) {
          // Half size keeps the decode cheap on a phone.
          canvas.width = Math.max(1, Math.floor(video.videoWidth / 2));
          canvas.height = Math.max(1, Math.floor(video.videoHeight / 2));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          const digits = hit?.data.match(/\d{6}/)?.[0];
          if (digits) {
            done = true;
            onCode(digits);
            return;
          }
        }
        frame = requestAnimationFrame(scan);
      };
      frame = requestAnimationFrame(scan);
    })();

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [open, onCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan the pair code</DialogTitle>
          <DialogDescription>Point the camera at the QR on the camera unit&apos;s screen.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
          {error ? (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
              {error}
            </p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
