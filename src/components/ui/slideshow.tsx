"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type SlideItem =
  | string // image URL or local path, e.g. "https://…/a.jpg" or "/images/a.jpg"
  | { src: string; alt?: string; caption?: string }

/** Frame shape of the slideshow. Any CSS ratio string such as "3/2" also works. */
export type SlideRatio = "HORIZONTAL" | "PORTRAIT" | "SQUARE" | "CLASSIC" | "CINEMA"
/**
 * How each image sits inside the frame.
 * BLUR: whole image centered, empty space filled with a blurred, zoomed copy.
 * COVER: fill the frame and crop. CONTAIN: whole image on a plain background.
 */
export type SlideFit = "BLUR" | "COVER" | "CONTAIN"

const RATIOS: Record<SlideRatio, string> = {
  HORIZONTAL: "16 / 9",
  PORTRAIT: "9 / 16",
  SQUARE: "1 / 1",
  CLASSIC: "4 / 3",
  CINEMA: "21 / 9",
}

export interface SlideshowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  slides: SlideItem[]
  /** "AUTO" advances on a timer, "MANUAL" only moves when the user does. */
  mode?: "AUTO" | "MANUAL"
  /** Milliseconds per slide in AUTO mode. */
  interval?: number
  loop?: boolean
  /** Show prev / next / play-pause buttons. */
  controls?: boolean
  /** Show dot navigation. */
  dots?: boolean
  pauseOnHover?: boolean
  /** Frame shape. Default "HORIZONTAL" (16:9). */
  ratio?: SlideRatio | (string & {})
  /** Image fitting. Default "BLUR". */
  fit?: SlideFit
  /** Click (or press Enter on) a slide to open a full-page preview. Default true. */
  lightbox?: boolean
  /** Accessible name for the carousel region. */
  label?: string
}

interface LightboxProps {
  item: { src: string; alt?: string; caption?: string }
  index: number
  count: number
  playing: boolean
  running: boolean
  interval: number
  onGo: (to: number) => void
  onTogglePlay: () => void
  onClose: () => void
}

function Lightbox({ item, index, count, playing, running, interval, onGo, onTogglePlay, onClose }: LightboxProps) {
  const startX = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") onGo(index - 1)
      else if (e.key === "ArrowRight") onGo(index + 1)
      else if (e.key === " ") {
        e.preventDefault()
        onTogglePlay()
      }
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [index, onGo, onClose, onTogglePlay])

  const btn =
    "absolute flex items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in-0 duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onPointerDown={(e) => {
        e.stopPropagation()
        startX.current = e.clientX
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        if (startX.current === null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) > 50) onGo(index + (dx < 0 ? 1 : -1))
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={item.alt ?? `Slide ${index + 1} of ${count}`}
        draggable={false}
        className="max-h-[88vh] max-w-[92vw] select-none rounded-md object-contain"
      />
      {item.caption && (
        <p className="absolute inset-x-0 bottom-12 px-6 text-center text-sm text-white/90">{item.caption}</p>
      )}
      <button type="button" aria-label="Close preview" onClick={onClose} className={cn(btn, "right-4 top-4 size-10")}>
        <X className="size-5" />
      </button>
      {count > 1 && (
        <>
          <button type="button" aria-label={playing ? "Pause slideshow" : "Play slideshow"} onClick={onTogglePlay} className={cn(btn, "right-16 top-4 size-10")}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" aria-label="Previous slide" onClick={() => onGo(index - 1)} className={cn(btn, "left-4 top-1/2 size-11 -translate-y-1/2")}>
            <ChevronLeft className="size-6" />
          </button>
          <button type="button" aria-label="Next slide" onClick={() => onGo(index + 1)} className={cn(btn, "right-4 top-1/2 size-11 -translate-y-1/2")}>
            <ChevronRight className="size-6" />
          </button>
        </>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs tabular-nums text-white/80">
        {index + 1} / {count}
      </div>
      {running && (
        <div
          key={index}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-white/80"
          style={{ animation: `slideshow-progress ${interval}ms linear forwards` }}
        />
      )}
    </div>,
    document.body
  )
}

const normalize = (s: SlideItem) => (typeof s === "string" ? { src: s } : s)

function Slideshow({
  slides,
  mode = "MANUAL",
  interval = 4000,
  loop = true,
  controls = true,
  dots = true,
  pauseOnHover = true,
  ratio = "HORIZONTAL",
  fit = "BLUR",
  lightbox = true,
  label = "Slideshow",
  className,
  style,
  ...props
}: SlideshowProps) {
  const items = React.useMemo(() => slides.map(normalize), [slides])
  const count = items.length
  const [index, setIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(mode === "AUTO")
  const [hovered, setHovered] = React.useState(false)
  const touchX = React.useRef<number | null>(null)
  const dragged = React.useRef(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => setPlaying(mode === "AUTO"), [mode])
  React.useEffect(() => {
    if (index >= count) setIndex(0)
  }, [count, index])

  const go = React.useCallback(
    (to: number) => {
      if (!count) return
      if (to < 0) return setIndex(loop ? count - 1 : 0)
      if (to >= count) return setIndex(loop ? 0 : count - 1)
      setIndex(to)
    },
    [count, loop]
  )

  const running = playing && count > 1 && (open || !(pauseOnHover && hovered))
  React.useEffect(() => {
    if (!running) return
    const t = setTimeout(() => go(index + 1), interval)
    return () => clearTimeout(t)
  }, [running, index, interval, go])

  const closeLightbox = React.useCallback(() => setOpen(false), [])
  const togglePlay = React.useCallback(() => setPlaying((p) => !p), [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (open) return
    if (e.key === "Enter" && lightbox) setOpen(true)
    else if (e.key === "ArrowLeft") go(index - 1)
    else if (e.key === "ArrowRight") go(index + 1)
    else if (e.key === " ") {
      e.preventDefault()
      setPlaying((p) => !p)
    }
  }

  if (!count) return null

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => {
        touchX.current = e.clientX
        dragged.current = false
      }}
      onPointerUp={(e) => {
        if (touchX.current === null) return
        const dx = e.clientX - touchX.current
        touchX.current = null
        dragged.current = Math.abs(dx) > 50
        if (dragged.current) go(index + (dx < 0 ? 1 : -1))
      }}
      className={cn(
        "group relative w-full select-none overflow-hidden rounded-xl bg-cream-200 outline-none focus-visible:ring-2 focus-visible:ring-glow-500 dark:bg-night-700",
        className
      )}
      style={{ aspectRatio: RATIOS[ratio as SlideRatio] ?? ratio, ...style }}
      {...props}
    >

      {items.map((s, i) => (
        <figure
          key={i}
          data-slide
          aria-hidden={i !== index}
          onClick={() => lightbox && i === index && !dragged.current && setOpen(true)}
          className={cn(
            "absolute inset-0 m-0 transition-opacity duration-500",
            lightbox && "cursor-zoom-in",
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {fit === "BLUR" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={s.src}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.src}
            alt={s.alt ?? `Slide ${i + 1} of ${count}`}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "relative h-full w-full",
              fit === "COVER" ? "object-cover" : "object-contain"
            )}
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
            className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/85 text-night-800 opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:bg-night-800/85 dark:text-cream-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/85 text-night-800 opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:bg-night-800/85 dark:text-cream-50"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            onClick={() => setPlaying((p) => !p)}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-cream-50/85 text-night-800 opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:bg-night-800/85 dark:text-cream-50"
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

      {open && items[index] && (
        <Lightbox
          item={items[index]}
          index={index}
          count={count}
          playing={playing}
          running={running}
          interval={interval}
          onGo={go}
          onTogglePlay={togglePlay}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}

export { Slideshow }
