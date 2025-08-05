import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes an Ethiopian phone number to the +251... format.
 * Handles formats like: +2519..., 2519..., 09..., and 9...
 * @param phoneNumber The phone number to normalize.
 * @returns The normalized phone number.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return '';
  }
  // Remove all non-digit characters except for a leading '+'
  let cleaned = phoneNumber.trim();

  if (cleaned.startsWith('+251')) {
    return cleaned;
  }
  if (cleaned.startsWith('251')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('09')) {
    return `+251${cleaned.substring(1)}`;
  }
  if (cleaned.length === 9 && (cleaned.startsWith('9') || cleaned.startsWith('7'))) {
     // Assume it's a 9-digit number without country code
    return `+251${cleaned}`;
  }
  // Return the original if it doesn't match known patterns,
  // or a more specific error/default format.
  return phoneNumber;
}
