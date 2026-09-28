const MAX_BYTES = 24000;
const fieldLimits = { firstName: 80, lastName: 80, email: 254, subject: 160, message: 5000 };
const fallback = 'Det gick inte att skicka just nu. Mejla info@bossbuss.com eller ring +46 76 881 91 20.';

function reply(request, status, message, ok = false) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (status === 405) headers.Allow = 'POST';
  if (status === 429) headers['Retry-After'] = '60';
  if (request.headers.get('Accept')?.includes('application/json')) {
    return Response.json({ ok, message }, { status, headers });
  }
  // All messages are fixed server strings; submitted content is never reflected.
  return new Response(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${ok ? 'Tack' : 'Kontakt'} | Bossbuss</title><style>body{font:18px/1.7 system-ui,sans-serif;max-width:650px;margin:12vh auto;padding:25px;background:#f8f9f5;color:#222}a{color:inherit}h1{line-height:1.15}main{border-top:8px solid #a6ce38;padding-top:25px}</style><main><h1>${ok ? 'Tack för din förfrågan!' : 'Meddelandet kunde inte skickas.'}</h1><p>${message}</p><p><a href="mailto:info@bossbuss.com">info@bossbuss.com</a> · <a href="tel:+46768819120">+46 76 881 91 20</a></p><a href="/kontakt/#forfragan">Tillbaka till kontakt</a></main></html>`, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}

async function limitedBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new RangeError();
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) { await reader.cancel(); throw new RangeError(); }
    parts.push(value);
  }
  return new Response(new Blob(parts), { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
}

export async function handleContact(request, env, send = fetch) {
  if (request.method !== 'POST') return reply(request, 405, 'Använd kontaktformuläret för att skicka en förfrågan.');
  // A native browser form and fetch both send Origin. Reject cross-site posts.
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(request, 403, 'Förfrågan kunde inte verifieras. Öppna formuläret på vår webbplats och försök igen.');
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) return reply(request, 415, 'Formulärets format kunde inte läsas.');
  let data;
  try { data = await limitedBody(request); }
  catch (error) { return reply(request, error instanceof RangeError ? 413 : 400, 'Meddelandet kunde inte läsas eller var för långt.'); }
  if (data.get('website')) return reply(request, 400, 'Förfrågan kunde inte verifieras. Kontakta oss via e-post.');
  const values = {};
  for (const [name, limit] of Object.entries(fieldLimits)) {
    const raw = data.get(name);
    if (typeof raw !== 'string' || data.getAll(name).length !== 1 || !raw.trim() || raw.length > limit) return reply(request, 400, 'Kontrollera att alla fält är ifyllda och att meddelandet inte är för långt.');
    values[name] = raw.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || /[\r\n\x00]/.test(values.email + values.subject + values.firstName + values.lastName) || values.message.length < 10) return reply(request, 400, 'Ange en giltig e-postadress och ett meddelande på minst 10 tecken.');
  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL || !env.CONTACT_FROM_EMAIL || !env.CONTACT_RATE_LIMITER) return reply(request, 503, fallback);
  try {
    const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
    if (!success) return reply(request, 429, 'Du har skickat flera förfrågningar på kort tid. Vänta en minut och försök igen.');
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [env.CONTACT_TO_EMAIL],
        reply_to: values.email,
        subject: `Webbförfrågan: ${values.subject}`,
        text: `Ny förfrågan från bossbuss.com\n\nNamn: ${values.firstName} ${values.lastName}\nE-post: ${values.email}\nÄmne: ${values.subject}\n\n${values.message}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply(request, 502, fallback);
    const result = await response.json();
    if (!result.id) return reply(request, 502, fallback);
    return reply(request, 200, 'Vi har tagit emot din förfrågan och återkommer så snart vi kan.', true);
  } catch { return reply(request, 502, fallback); }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/contact') return handleContact(request, env);
    if (path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
