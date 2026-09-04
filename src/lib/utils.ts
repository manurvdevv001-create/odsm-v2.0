import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string or Date object to dd/mm/yyyy (French format).
 * Returns empty string for invalid/empty inputs.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getInitials(firstName: string, lastName: string, middleName?: string) {
  return `${lastName?.[0] || ''}${middleName?.[0] || ''}${firstName?.[0] || ''}`.toUpperCase();
}

export function getTeacherFullName(teacher: { firstName: string, lastName: string, middleName?: string | null }) {
  if (!teacher) return '';
  return `${teacher.lastName} ${teacher.middleName ? teacher.middleName + ' ' : ''}${teacher.firstName}`;
}

export function getTeacherShortName(teacher: { firstName: string, lastName: string, middleName?: string | null } | string) {
  if (!teacher) return '';

  if (typeof teacher === 'string') {
    const parts = teacher.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].toUpperCase();
    const lastName = parts[0].toUpperCase();
    const initials = parts.slice(1).map(p => p[0].toUpperCase() + '.').join(' ');
    return `${lastName} ${initials}`.trim();
  }

  const { firstName, lastName, middleName } = teacher;
  const firstInitial = firstName?.[0] ? `${firstName[0].toUpperCase()}.` : '';
  const middleInitial = middleName?.[0] ? `${middleName[0].toUpperCase()}.` : '';
  return `${lastName.toUpperCase()} ${middleInitial} ${firstInitial}`.replace(/\s+/g, ' ').trim();
}

/**
 * Automatically format a string according to ODSM-v2 rules:
 * - Nom/Postnom -> UPPERCASE
 * - Prénom -> Title Case (Jean-Yves, Jean Yves)
 */
export function formatToUppercase(value: string): string {
  return value.toUpperCase();
}

export function formatToTitleCase(value: string): string {
  if (!value) return "";
  return value
    .split(/([ \-])/) // Split by space or hyphen, but keep the delimiter
    .map((word) => {
      if (word === " " || word === "-") return word;
      if (word === "") return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

/**
 * Normalizes a name string by removing accents, converting to lowercase, and collapsing multiple spaces.
 */
export function normalizeName(str: string): string {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
}

/**
 * Robustly checks if two teacher names match.
 * Handles different word orders, accents, and partial overlaps (e.g. "HARRIS YANGO Samuel" vs "Samuel HARRIS YANGO").
 */
export function matchTeacherName(profileName: string | null | undefined, slotName: string | null | undefined): boolean {
  if (!profileName || !slotName) return false;
  
  const normProfile = normalizeName(profileName);
  const normSlot = normalizeName(slotName);
  
  // Exact match or simple substring match
  if (normProfile === normSlot) return true;
  if (normProfile.includes(normSlot) || normSlot.includes(normProfile)) return true;
  
  // Token-based overlap matching
  const profileParts = normProfile.split(/\s+/);
  const slotParts = normSlot.split(/\s+/);
  
  const commonParts = slotParts.filter(part => profileParts.includes(part));
  
  // If all slot words exist in the profile name (in any order)
  if (commonParts.length === slotParts.length && slotParts.length > 0) return true;
  
  // If they share at least 2 words, consider it a match
  if (commonParts.length >= 2) return true;
  
  return false;
}

