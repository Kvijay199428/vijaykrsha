import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface NeuSelectOption {
  value: string;
  label: string;
}

interface NeuSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NeuSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NeuSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
}: NeuSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;
  const isPlaceholder = !selected;

  const close = useCallback(() => {
    setOpen(false);
    setHighlightIdx(-1);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlightIdx]);

  const toggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const selectOption = (val: string) => {
    onChange(val);
    close();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : 0);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : 0);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightIdx(idx >= 0 ? idx : options.length - 1);
        }
        break;
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < options.length) selectOption(options[highlightIdx]!.value);
        break;
      case "Home":
        e.preventDefault();
        setHighlightIdx(0);
        break;
      case "End":
        e.preventDefault();
        setHighlightIdx(options.length - 1);
        break;
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center justify-between gap-2 px-3 py-2 neu-concave rounded-xl bg-transparent text-sm text-foreground text-left min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/50 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`truncate ${isPlaceholder ? "text-muted-foreground" : ""}`}>
          {displayText}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute top-full left-0 mt-1 w-full min-w-[120px] max-h-60 overflow-auto z-50 neu-flat rounded-xl p-1 focus:outline-none"
        >
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => selectOption(opt.value)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-all select-none ${
                opt.value === value
                  ? "neu-pressed text-primary font-medium"
                  : idx === highlightIdx
                    ? "neu-btn"
                    : "text-foreground hover:bg-muted/30"
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
