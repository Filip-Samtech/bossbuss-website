import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleContact } from '../worker/index.mjs';

const good = { firstName: 'Test', lastName: 'Testsson', email: 'test@example.com', subject: 'Lokal testförfrågan', message: 'Detta är ett lokalt test. Inget mejl ska skickas.', website: '' };
const env = { RESEND_API_KEY: 'test-only', CONTACT_TO_EMAIL: 'info@bossbuss.com', CONTACT_FROM_EMAIL: 'webb@bossbuss.com', CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
function request(changes = {}, options = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...good, ...changes })) data.set(key, value);
  return new Request('https://bossbuss.com/api/contact', { method: 'POST', headers: { Origin: 'https://bossbuss.com', Accept: 'application/json', ...options.headers }, body: data });
}
const neverSend = async () => { assert.fail('No email API call should be made'); };

test('valid request reaches the fixed recipient and sets reply-to', async () => {
  let sent;
  const response = await handleContact(request(), env, async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); sent = JSON.parse(options.body); return Response.json({ id: 'local-test' }); });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(sent.to, ['info@bossbuss.com']);
  assert.equal(sent.reply_to, good.email);
  assert.match(sent.text, /Test Testsson/);
});
test('missing mail credentials returns a real error', async () => {
  const response = await handleContact(request(), {}, neverSend);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
test('cross-origin and missing origin are rejected', async () => {
  for (const origin of ['https://other.example', '']) assert.equal((await handleContact(request({}, { headers: { Origin: origin } }), env, neverSend)).status, 403);
});
test('empty values, invalid email, short message and header injection are rejected', async () => {
  for (const data of [{ firstName: ' ' }, { email: 'invalid' }, { message: 'kort' }, { subject: 'Hello\r\nBcc:other@example.com' }, { lastName: 'A'.repeat(81) }]) assert.equal((await handleContact(request(data), env, neverSend)).status, 400);
});
test('honeypot blocks automated submissions', async () => {
  assert.equal((await handleContact(request({ website: 'spam' }), env, neverSend)).status, 400);
});
test('oversized body is bounded before parsing', async () => {
  const oversized = new Request('https://bossbuss.com/api/contact', { method: 'POST', headers: { Origin: 'https://bossbuss.com', Accept: 'application/json' }, body: new URLSearchParams({ ...good, message: 'x'.repeat(30000) }) });
  assert.equal((await handleContact(oversized, env, neverSend)).status, 413);
});
test('limiter failure prevents email and sets retry-after', async () => {
  const response = await handleContact(request(), { ...env, CONTACT_RATE_LIMITER: { limit: async () => ({ success: false }) } }, neverSend);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
});
test('provider rejection, malformed success and exception never show success', async () => {
  for (const send of [async () => new Response('Unavailable', { status: 503 }), async () => Response.json({}), async () => { throw new Error('Network failure'); }]) {
    const response = await handleContact(request(), env, send);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
  }
});
test('native no-JavaScript form receives a readable HTML receipt', async () => {
  const response = await handleContact(request({}, { headers: { Accept: 'text/html' } }), env, async () => Response.json({ id: 'local-test' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(await response.text(), /Tack för din förfrågan/);
});
test('unsupported method is rejected', async () => {
  const response = await handleContact(new Request('https://bossbuss.com/api/contact'), env, neverSend);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
});
test('static requests pass through and unknown API paths return 404', async () => {
  assert.equal((await worker.fetch(new Request('https://bossbuss.com/om-oss/'), { ASSETS: { fetch: async () => new Response('static page') } })).status, 200);
  assert.equal((await worker.fetch(new Request('https://bossbuss.com/api/unknown'), env)).status, 404);
});
