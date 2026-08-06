/**
 * Client-side Rate Limiter Helper to prevent spamming actions (chat messages, room updates).
 */

const actionTimestamps = new Map<string, number[]>();

export function isRateLimited(key: string, maxCalls = 5, windowMs = 10000): boolean {
  const now = Date.now();
  const timestamps = actionTimestamps.get(key) ?? [];

  // Filter timestamps within the rolling window
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxCalls) {
    return true;
  }

  validTimestamps.push(now);
  actionTimestamps.set(key, validTimestamps);
  return false;
}
