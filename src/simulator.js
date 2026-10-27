/** Deterministic webhook-delivery teaching model. It performs no network I/O. */
export const SCENARIOS = Object.freeze({
  steady: { label: 'Clean delivery', responses: [200], insight: 'A successful 2xx response ends delivery immediately. A receiver should still verify the event before processing it.' },
  flaky: { label: 'Receiver recovers', responses: [503, 429, 200], insight: '503 and 429 are treated as retryable here. Exponential backoff spaces attempts out before the successful third attempt.' },
  down: { label: 'Receiver stays down', responses: [503], insight: 'The receiver never recovers in this scenario. A finite retry budget ends the run; production systems also need a durable failure queue and alerting.' },
  duplicate: { label: 'Duplicate event', responses: [200, 200], insight: 'Two deliveries carry the same event ID. An idempotent receiver acknowledges a repeat without applying it twice.' },
  'bad-signature': { label: 'Invalid signature', responses: [401], insight: 'The simulated receiver rejects a request whose signature check fails. Verify signatures over the exact raw request body before processing.' }
});
const MAX_RETRIES_LIMIT = 5;
const MAX_DELAY_MS = 30_000;
export function backoffSchedule({ retries = 3, baseDelayMs = 1000, maxDelayMs = MAX_DELAY_MS } = {}) {
  validateInteger('retries', retries, 0, MAX_RETRIES_LIMIT);
  validateInteger('baseDelayMs', baseDelayMs, 0, MAX_DELAY_MS);
  validateInteger('maxDelayMs', maxDelayMs, 0, MAX_DELAY_MS);
  return Array.from({ length: retries }, (_, i) => Math.min(baseDelayMs * (2 ** i), maxDelayMs));
}
/** Simulate one event. The first attempt is immediate; retryable failures use bounded backoff. */
export function simulateDelivery({ scenario = 'steady', retries = 3, baseDelayMs = 1000, eventId = 'evt_demo_001' } = {}) {
  const config = SCENARIOS[scenario];
  if (!config) throw new RangeError(`Unknown scenario: ${scenario}`);
  validateInteger('retries', retries, 0, MAX_RETRIES_LIMIT);
  validateInteger('baseDelayMs', baseDelayMs, 0, MAX_DELAY_MS);
  if (typeof eventId !== 'string' || eventId.trim() === '') throw new TypeError('eventId must be a non-empty string');
  const retryDelays = backoffSchedule({ retries, baseDelayMs });
  const attempts = [];
  for (let i = 0; i <= retries; i += 1) {
    const response = config.responses[Math.min(i, config.responses.length - 1)];
    attempts.push({ eventId, attempt: i + 1, response, waitMs: i === 0 ? 0 : retryDelays[i - 1] });
    if ((response >= 200 && response < 300) || response === 401 || response === 403) break;
  }
  const finalResponse = attempts.at(-1).response;
  const delivered = finalResponse >= 200 && finalResponse < 300;
  const exhausted = !delivered && attempts.length === retries + 1 && finalResponse !== 401 && finalResponse !== 403;
  return { scenario, eventId, attempts, delivered, exhausted, finalResponse, insight: config.insight };
}
/** In-memory receiver: each event ID produces at most one effect per instance. */
export function createIdempotentReceiver() {
  const processed = new Set(); let effects = 0;
  return Object.freeze({
    receive(eventId) {
      if (typeof eventId !== 'string' || eventId.trim() === '') throw new TypeError('eventId must be a non-empty string');
      if (processed.has(eventId)) return { accepted: true, duplicate: true, effects };
      processed.add(eventId); effects += 1;
      return { accepted: true, duplicate: false, effects };
    },
    get effects() { return effects; }, get processedCount() { return processed.size; }
  });
}
export async function hmacSha256Hex(secret, message) {
  if (typeof secret !== 'string' || typeof message !== 'string') throw new TypeError('secret and message must be strings');
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Web Crypto is unavailable; use a modern browser or Node.js 18+');
  const enc = new TextEncoder();
  const key = await cryptoApi.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await cryptoApi.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyHmacSha256(secret, message, expectedHex) {
  if (typeof expectedHex !== 'string' || !/^[a-f\d]{64}$/i.test(expectedHex)) return false;
  const actual = await hmacSha256Hex(secret, message);
  let difference = actual.length ^ expectedHex.length;
  for (let i = 0; i < actual.length; i += 1) difference |= actual.charCodeAt(i) ^ (expectedHex.toLowerCase().charCodeAt(i) || 0);
  return difference === 0;
}
function validateInteger(name, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
}
