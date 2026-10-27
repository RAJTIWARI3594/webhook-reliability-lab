import { SCENARIOS, createIdempotentReceiver, hmacSha256Hex, simulateDelivery, verifyHmacSha256 } from './simulator.js';
const $ = s => document.querySelector(s);
const scenarioInput = $('#scenario'), retryInput = $('#retries'), delayInput = $('#base-delay'), log = $('#attempt-log'), statePill = $('#state-pill');
let runNumber = 0;
retryInput.addEventListener('input', () => { $('#retries-value').textContent = `${retryInput.value} ${retryInput.value === '1' ? 'retry' : 'retries'}`; });
delayInput.addEventListener('input', () => { $('#delay-value').textContent = `${(Number(delayInput.value) / 1000).toFixed(1)} sec`; });
$('#run-button').addEventListener('click', runSimulation);
$('#signature-button').addEventListener('click', runSignatureExperiment);
function runSimulation() {
  runNumber += 1;
  const scenario = scenarioInput.value;
  const result = simulateDelivery({ scenario, retries: Number(retryInput.value), baseDelayMs: Number(delayInput.value), eventId: `evt_demo_${String(runNumber).padStart(3, '0')}` });
  const receiver = createIdempotentReceiver(); log.replaceChildren(); let elapsed = 0;
  const rows = scenario === 'duplicate' ? [...result.attempts, { ...result.attempts[0], attempt: 2, waitMs: Number(delayInput.value) }] : result.attempts;
  rows.forEach((attempt, index) => {
    elapsed += attempt.waitMs;
    const receipt = result.delivered ? receiver.receive(attempt.eventId) : null;
    const item = document.createElement('li'); item.className = `attempt ${attempt.response >= 200 && attempt.response < 300 ? 'success' : attempt.response === 401 ? 'rejected' : 'retry'}`;
    const number = document.createElement('span'); number.className = 'attempt-number'; number.textContent = String(index + 1).padStart(2, '0');
    const detail = document.createElement('div'); detail.className = 'attempt-detail';
    const title = document.createElement('strong'); title.textContent = attempt.response >= 200 && attempt.response < 300 ? (receipt?.duplicate ? 'Duplicate acknowledged' : 'Delivery accepted') : attempt.response === 401 ? 'Signature rejected' : 'Retry scheduled';
    const meta = document.createElement('span'); meta.textContent = `ID ${attempt.eventId} · HTTP ${attempt.response}`; detail.append(title, meta);
    const time = document.createElement('span'); time.className = 'attempt-time'; time.textContent = index === 0 ? 'T + 0 ms' : `T + ${elapsed.toLocaleString()} ms`;
    const badge = document.createElement('span'); badge.className = `response-badge ${attempt.response >= 200 && attempt.response < 300 ? 'ok' : attempt.response === 401 ? 'blocked' : 'again'}`; badge.textContent = receipt?.duplicate ? 'NO-OP' : `HTTP ${attempt.response}`;
    item.append(number, detail, time, badge); log.append(item);
  });
  const finalLabel = result.delivered ? 'DELIVERED' : result.finalResponse === 401 ? 'REJECTED' : 'EXHAUSTED';
  statePill.className = `state-pill ${result.delivered ? 'is-success' : 'is-failure'}`; statePill.lastChild.textContent = ` ${finalLabel}`;
  $('#trace-caption').textContent = `${SCENARIOS[scenario].label} · ${result.eventId}`;
  $('#metric-attempts').textContent = String(rows.length).padStart(2, '0'); $('#metric-response').textContent = String(result.finalResponse);
  $('#metric-event').textContent = result.delivered ? `${receiver.effects} EFFECT${receiver.effects === 1 ? '' : 'S'}` : finalLabel;
  $('#scenario-insight').querySelector('p').textContent = result.insight;
}
async function runSignatureExperiment() {
  const panel = $('#signature-panel'); panel.hidden = false;
  const secret = 'local-demo-secret-not-for-production';
  const body = JSON.stringify({ event: 'invoice.paid', id: 'evt_demo_sig_01', amount: 4200 });
  const edited = body.replace('4200', '4201'); const signature = await hmacSha256Hex(secret, body);
  const valid = await verifyHmacSha256(secret, body, signature), changedValid = await verifyHmacSha256(secret, edited, signature);
  $('#sig-original').textContent = body; $('#sig-value').textContent = `sha256=${signature.slice(0, 24)}…`;
  $('#sig-edited').textContent = valid && !changedValid ? 'Mismatch detected' : 'Check unavailable';
  $('#sig-verdict').textContent = valid && !changedValid ? '✓ Original verifies · edited body rejected' : 'Unable to verify this run';
  $('#sig-verdict').className = `sig-verdict ${valid && !changedValid ? 'verified' : 'unverified'}`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
