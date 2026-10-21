import * as React from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

export type SlideItem =
  | string // image URL or local path, e.g. "https://…/a.jpg" or "/images/a.jpg"
  | { src: string; alt?: string; caption?: string };

export type SlideAspect = "video" | "portrait" | "square";

export interface SlideshowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  slides: SlideItem[];
  /** "AUTO" advances on a timer, "MANUAL" only moves when the user does. */
  mode?: "AUTO" | "MANUAL";
  /** Milliseconds per slide in AUTO mode. */
  interval?: number;
  loop?: boolean;
  /** Show prev / next / play-pause buttons. */
  controls?: boolean;
  /** Show dot navigation. */
  dots?: boolean;
  pauseOnHover?: boolean;
  /**
   * Frame shape. "portrait" fits 9:20 phone screenshots, "video" the
   * 16:9 default, "square" square crops.
   */
  aspect?: SlideAspect;
  /** Accessible name for the carousel region. */
  label?: string;
}

const ASPECT_CLASS: Record<SlideAspect, string> = {
  video: "aspect-video",
  portrait: "aspect-[9/20]",
  square: "aspect-square",
};

const normalize = (s: SlideItem) => (typeof s === "string" ? { src: s } : s);

function Slideshow({
  slides,
  mode = "MANUAL",
  interval = 4000,
  loop = true,
  controls = true,
  dots = true,
  pauseOnHover = true,
  aspect = "video",
  label = "Slideshow",
  className,
  ...props
}: SlideshowProps) {
  const items = React.useMemo(() => slides.map(normalize), [slides]);
  const count = items.length;
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(mode === "AUTO");
  const [hovered, setHovered] = React.useState(false);
  const touchX = React.useRef<number | null>(null);

  React.useEffect(() => setPlaying(mode === "AUTO"), [mode]);
  React.useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const go = React.useCallback(
    (to: number) => {
      if (!count) return;
      if (to < 0) return setIndex(loop ? count - 1 : 0);
      if (to >= count) return setIndex(loop ? 0 : count - 1);
      setIndex(to);
    },
    [count, loop]
  );

  const running = playing && !(pauseOnHover && hovered) && count > 1;
  React.useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => go(index + 1), interval);
    return () => clearTimeout(t);
  }, [running, index, interval, go]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === " ") {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  if (!count) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => (touchX.current = e.clientX)}
      onPointerUp={(e) => {
        if (touchX.current === null) return;
        const dx = e.clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
      className={cn(
        "group relative w-full select-none overflow-hidden rounded-xl bg-cream-200 dark:bg-night-700 outline-none focus-visible:ring-2 focus-visible:ring-glow-500",
        ASPECT_CLASS[aspect],
        className
      )}
      {...props}
    >
      {items.map((s, i) => (
        <figure
          key={i}
          data-slide
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 m-0 transition-opacity duration-500",
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.src}
            alt={s.alt ?? `Slide ${i + 1} of ${count}`}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full object-cover"
          />
          {s.caption && (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-10 text-sm text-white">
              {s.caption}
            </figcaption>
          )}
        </figure>
      ))}

      {controls && count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/85 text-night-800 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 opacity-0 dark:bg-night-800/85 dark:text-cream-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/85 text-night-800 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 opacity-0 dark:bg-night-800/85 dark:text-cream-50"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            onClick={() => setPlaying((p) => !p)}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-cream-50/85 text-night-800 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 opacity-0 dark:bg-night-800/85 dark:text-cream-50"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </>
      )}

      {dots && count > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-glow-500"
                  : "w-1.5 bg-night-800/40 hover:bg-night-800/70 dark:bg-cream-100/50 dark:hover:bg-cream-100/80"
              )}
            />
          ))}
        </div>
      )}

      {running && (
        <div
          key={index}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-glow-500"
          style={{ animation: `slideshow-progress ${interval}ms linear forwards` }}
        />
      )}
    </div>
  );
}

export { Slideshow };
