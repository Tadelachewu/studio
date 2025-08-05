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
  console.log(`[Normalize] Input: "${phoneNumber}", Cleaned: "${cleaned}"`);

  if (cleaned.startsWith('+251')) {
    console.log(`[Normalize] Output (already standard): "${cleaned}"`);
    return cleaned;
  }
  if (cleaned.startsWith('251')) {
    const normalized = `+${cleaned}`;
    console.log(`[Normalize] Output (from 251...): "${normalized}"`);
    return normalized;
  }
  if (cleaned.startsWith('09')) {
    const normalized = `+251${cleaned.substring(1)}`;
    console.log(`[Normalize] Output (from 09...): "${normalized}"`);
    return normalized;
  }
  if (cleaned.length === 9 && (cleaned.startsWith('9') || cleaned.startsWith('7'))) {
    const normalized = `+251${cleaned}`;
    console.log(`[Normalize] Output (from 9...): "${normalized}"`);
    return normalized;
  }
  
  console.log(`[Normalize] Output (unrecognized format): "${phoneNumber}"`);
  return phoneNumber;
}
