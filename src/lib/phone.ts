/**
 * Normalize phone number to international format without + or spaces.
 * Handles common Indonesia formats:
 *   085721622577  → 6285721622577
 *   +628572162577 → 6285721622577
 *   6285721622577  → 6285721622577 (already correct)
 *   85721622577    → 6285721622577
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-+]/g, '')

  if (cleaned.startsWith('62')) return cleaned
  if (cleaned.startsWith('08')) return '62' + cleaned.substring(1)
  if (cleaned.startsWith('8')) return '62' + cleaned
  if (cleaned.startsWith('0')) return '62' + cleaned.substring(1)

  return cleaned
}