/**
 * Utility functions for user input sanitization and XSS prevention.
 */

/**
 * Escapes HTML special characters in plain text input.
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validates whether a URL is a valid http(s) or relative video stream URL.
 */
export function isValidStreamUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitizes room code / inputs to uppercase alphanumeric string.
 */
export function sanitizeRoomCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
}
