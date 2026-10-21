import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn's class-name helper: `clsx` resolves conditional/array/object
 * inputs, `twMerge` then drops earlier Tailwind utilities that a later
 * one contradicts (so a caller's `className` reliably overrides a
 * component default).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
