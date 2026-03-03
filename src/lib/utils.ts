import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Table, FloorLabel } from "@/lib/types";

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

/**
 * Compute a bounding box that encloses all tables and labels with padding.
 */
export function computeFloorPlanBounds(
  tables: Table[],
  labels: FloorLabel[],
  tablePad = 350,
  labelPad = 50
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.position.x - tablePad);
    minY = Math.min(minY, t.position.y - tablePad);
    maxX = Math.max(maxX, t.position.x + tablePad);
    maxY = Math.max(maxY, t.position.y + tablePad);
  }
  for (const l of labels) {
    minX = Math.min(minX, l.position.x - l.width - labelPad);
    minY = Math.min(minY, l.position.y - l.height - labelPad);
    maxX = Math.max(maxX, l.position.x + l.width + labelPad);
    maxY = Math.max(maxY, l.position.y + l.height + labelPad);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
