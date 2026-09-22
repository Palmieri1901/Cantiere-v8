import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export function QrScanner({ onResult, active = true }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    let stream, raf, stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) onResult(code.data);
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("Fotocamera non disponibile: consenti l'accesso o usa l'incolla manuale."));
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [active, onResult]);

  return (
    <div className="space-y-2" data-testid="qr-scanner">
      <video ref={videoRef} muted playsInline className="w-full rounded-md bg-black aspect-video object-cover" />
      {error && <div className="text-xs text-destructive" data-testid="qr-scanner-error">{error}</div>}
    </div>
  );
}
