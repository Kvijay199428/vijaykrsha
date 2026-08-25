import { useRef, useState, useEffect, useCallback } from "react";

interface OtpDigitInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
}

export default function OtpDigitInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  disabled = false,
  error = false,
}: OtpDigitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreNextChange = useRef(false);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] || "")
  );
  const [popIndex, setPopIndex] = useState<number>(-1);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setDigits(Array.from({ length }, (_, i) => value[i] || ""));
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(t);
    }
  }, [error]);

  const triggerPop = useCallback((index: number) => {
    setPopIndex(index);
    setTimeout(() => setPopIndex(-1), 200);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return;
      }
      const raw = e.target.value.replace(/\D/g, "").slice(0, length);
      if (raw.length > value.length) {
        triggerPop(raw.length - 1);
      }
      onChange(raw);
      if (inputRef.current) {
        const pos = raw.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    },
    [onChange, length, value.length, triggerPop]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && value.length > 0) {
        ignoreNextChange.current = true;
        onChange(value.slice(0, -1));
      }
    },
    [onChange, value]
  );

  const handleContainerClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const isComplete = value.length === length;

  return (
    <div
      className={`flex items-center justify-center gap-2 ${shaking ? "otp-digit-shake" : ""}`}
      onClick={handleContainerClick}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={length}
        disabled={disabled}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        aria-label={`Enter ${length}-digit code`}
      />
      {Array.from({ length }, (_, i) => {
        const digit = digits[i] || "";
        const isCurrent = i === value.length && !isComplete;
        const isPopping = i === popIndex;
        const isFilled = i < value.length;

        return (
          <div
            key={i}
            className={`
              w-11 h-14 flex items-center justify-center rounded-xl text-lg font-mono font-semibold
              transition-all duration-150
              ${isPopping ? "otp-digit-pop" : ""}
              ${isFilled ? "otp-digit-glow" : ""}
              ${isCurrent
                ? "neu-concave ring-2 ring-primary/50"
                : isFilled
                  ? "neu-concave"
                  : "neu-concave"
              }
              ${error ? "ring-2 ring-red-400/60" : ""}
              ${disabled ? "opacity-50" : "cursor-text"}
            `}
            style={{ caretColor: "transparent" }}
          >
            {digit && (
              <span
                className={
                  isFilled
                    ? "text-slate-800 dark:text-slate-100"
                    : "text-transparent"
                }
              >
                {digit}
              </span>
            )}
            {isCurrent && !disabled && (
              <span className="w-0.5 h-5 bg-primary animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
