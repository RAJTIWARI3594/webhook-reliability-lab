# Webhook Reliability Lab

A dependency-free browser project for exploring delivery retries, exponential backoff, duplicate events, idempotency and HMAC signatures. This is a local learning simulator—not a webhook sender, endpoint tester or production delivery service.

## Run locally
Requirements: Python 3 for the static server; Node.js 18+ for tests. No package installation is needed.

```sh
npm test
npm start
```

Open <http://localhost:4173>. The app makes no external API, webhook, analytics or font requests. The signature experiment uses Web Crypto and a sample secret; never use it for a real system.

## Scenarios
- **Clean delivery:** one 2xx response ends the run.
- **Receiver recovers:** deterministic 503, 429, then 200 responses show bounded exponential backoff.
- **Receiver stays down:** a retryable response repeats until the retry budget is spent.
- **Duplicate event:** the same event ID reaches an in-memory receiver twice, which records one effect.
- **Invalid signature:** a 401 response is terminal in this teaching model.
- **Signature experiment:** HMAC-SHA-256 runs locally; changing one character invalidates the signature.

All attempts, responses, delays and effects are simulated. No HTTP request is made. Runs are deterministic and reproducible.

## Architecture
- `index.html` — semantic interface and controls.
- `src/styles.css` — responsive, dependency-free styles.
- `src/simulator.js` — retry model, backoff, in-memory idempotency receiver and Web Crypto helpers.
- `src/app.js` — browser UI wiring; dynamic values are rendered as text.
- `tests/simulator.test.js` — Node built-in test suite for bounds, delivery, exhaustion, idempotency and signatures.

Production retry schedules, retryable codes, signing formats, secret rotation, persistence, queues and idempotency retention vary by provider/application. Production signature checks should use exact raw bytes and the provider's established format.

## License
MIT. See [LICENSE](LICENSE).
