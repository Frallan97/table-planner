import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format guest name as "FirstName FirstLetterInLastname"
 * e.g., "John Doe" -> "John D."
 *      "Alice" -> "Alice"
 */
export function formatGuestNameCompact(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    // Only first name, return as is
    return parts[0];
  }

  // First name + first letter of last name with period
  const firstName = parts[0];
  const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase();

  return `${firstName} ${lastNameInitial}.`;
}
