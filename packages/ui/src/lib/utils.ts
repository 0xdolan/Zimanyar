import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Join class names, with later Tailwind classes winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
