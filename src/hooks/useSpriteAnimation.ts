import { useEffect, useRef, useCallback } from "react";

interface SpriteConfig {
  src: string;
  fps: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  loop: boolean;
}

async function loadGzippedImage(src: string): Promise<HTMLImageElement> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch sprite: ${res.status}`);

  const buffer = await res.arrayBuffer();

  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not supported");
  }

  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(buffer));
  writer.close();

  const decompressed = await new Response(ds.readable).arrayBuffer();
  const blob = new Blob([decompressed], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load decompressed sprite"));
    };
    img.src = url;
  });
}

export default function useSpriteAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: SpriteConfig
) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: number) => {
      const { frameWidth, frameHeight, scale, opacity, blendMode } = config;
      const dw = frameWidth * scale;
      const dh = frameHeight * scale;

      ctx.clearRect(0, 0, dw, dh);
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;

      ctx.drawImage(
        image,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        dw,
        dh
      );
    },
    [config]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frameWidth, frameHeight, scale, frames, fps, loop } = config;
    const dw = frameWidth * scale;
    const dh = frameHeight * scale;

    canvas.width = dw;
    canvas.height = dh;

    let cancelled = false;

    const animate = (timestamp: number) => {
      if (cancelled) return;

      if (!loadedRef.current || !imageRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const interval = 1000 / fps;

      if (timestamp - lastTimeRef.current >= interval) {
        lastTimeRef.current = timestamp;
        drawFrame(ctx, imageRef.current, frameRef.current);

        if (frameRef.current < frames - 1) {
          frameRef.current++;
        } else if (loop) {
          frameRef.current = 0;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const loadAndStart = async () => {
      try {
        imageRef.current = await loadGzippedImage(config.src);
        loadedRef.current = true;

        if (prefersReducedMotion) {
          drawFrame(ctx, imageRef.current, 0);
          return;
        }

        rafRef.current = requestAnimationFrame(animate);
      } catch (e) {
        console.warn("Sprite animation failed:", e);
        canvas.style.display = "none";
      }
    };

    loadAndStart();

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else if (loadedRef.current && !prefersReducedMotion) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canvasRef, config, drawFrame, prefersReducedMotion]);
}
