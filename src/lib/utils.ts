import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names into a single string, resolving Tailwind CSS conflicts.
 * This utility function uses `clsx` to conditionally join class names and `tailwind-merge`
 * to intelligently merge Tailwind CSS classes, ensuring that conflicting utility classes
 * are resolved correctly (e.g., `px-2` and `px-4` would result in `px-4`).
 *
 * @param {...ClassValue} inputs - A list of class values. These can be strings, arrays, or objects.
 *                                 See `clsx` documentation for more details on accepted value types.
 * @returns {string} A string of combined and merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
