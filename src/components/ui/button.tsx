import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2 cursor-pointer";
    const variants: Record<string, string> = {
      default:
        "neu-btn text-primary-foreground font-semibold shadow-none border-0",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl",
      outline:
        "neu-btn text-foreground border-0",
      ghost:
        "bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
