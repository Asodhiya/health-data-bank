/*
  sanitize.js — Input sanitization utilities

  WHY THIS EXISTS:
  React already escapes content in JSX (prevents XSS at render time).
  But we still sanitize inputs for two reasons:

  1. Defense-in-depth: Raw text gets sent to the backend and stored
     in the database. If any future code (admin panel, CSV export,
     email template) renders it without escaping, it would be vulnerable.
     Sanitizing on input means dirty data never reaches the DB.

  2. Data quality: Stripping HTML tags, trimming whitespace, and
     enforcing length limits keeps stored data clean.

  WHAT THIS DOES NOT REPLACE:
  - Backend validation (always validate server-side too)
  - Parameterized queries (handled by SQLAlchemy ORM — prevents SQL injection)
  - Content Security Policy headers (configured on the server/proxy)
*/

/**
 * Sanitize a text string:
 * - Strips all HTML tags (prevents stored XSS)
 * - Strips HTML entities like &lt; &gt; &amp;
 * - Collapses multiple spaces into one
 * - Enforces a max character length
 *
 * NOTE: We do NOT trim here — trimming on every keystroke prevents the
 * user from typing a space before their next word. Trim on submit instead.
 *
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed characters (default: 500)
 * @returns {string} Sanitized string
 */
export function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<[^>]*>/g, '')       // Strip HTML/script tags
    .replace(/&[a-zA-Z]+;/g, '')   // Strip HTML entities
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .slice(0, maxLength);           // Enforce max length
}

/**
 * Sanitize a number input:
 * - Returns empty string if input is empty (allows clearing the field)
 * - Returns null if input is not a valid integer
 * - Clamps the value between min and max
 *
 * @param {string} input - Raw input value from an <input type="number">
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {string|null} Sanitized number as string, empty string, or null (rejected)
 */
export function sanitizeNumber(input, min = 0, max = Infinity) {
  if (input === '') return '';

  const num = parseInt(input, 10);
  if (isNaN(num)) return null;             // Reject non-numeric
  if (num < min || num > max) return null;  // Reject out-of-range

  return String(num);
}

/**
 * Sanitize an email address:
 * - Strips HTML tags
 * - Removes all whitespace
 * - Enforces RFC 5321 max length (254 chars)
 *
 * @param {string} input - Raw email input
 * @returns {string} Sanitized email
 */
export function sanitizeEmail(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<[^>]*>/g, '')    // Strip tags
    .replace(/\s/g, '')         // Remove all whitespace
    .slice(0, 254);             // RFC 5321 max email length
}

/**
 * Trim all string values in an object before API submission.
 * Recursively handles nested objects and arrays.
 *
 * @param {*} obj - The payload (object, array, or primitive)
 * @returns {*} Deep-trimmed copy
 */
export function trimPayload(obj) {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimPayload);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, trimPayload(v)])
    );
  }
  return obj;
}
