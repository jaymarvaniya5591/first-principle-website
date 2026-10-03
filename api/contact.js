// The browser never receives the Google webhook URL or shared secret.
const DEFAULT_ORIGINS = ['https://getfirstprinciple.com', 'https://www.getfirstprinciple.com'];
const FAILURE = 'We could not confirm your submission. Please try again, or email founder@getfirstprinciple.com.';

export function validateLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid form.');
  const limits = { firstName: 80, lastName: 80, email: 254, phone: 40, message: 4000, company: 200 };
  const lead = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error('Invalid form field.');
    lead[key] = (body[key] || '').trim();
    if (lead[key].length > limit || (key !== 'message' && /[\x00-\x1f\x7f]/.test(lead[key]))) {
      throw new Error('Please shorten your entry and remove unexpected line breaks.');
    }
  }
  if (!lead.firstName && !lead.lastName) throw new Error('Please enter a first name or a last name.');
  if (!/^[^\s@<>(),;:"\\\[\]]+@[^\s@<>(),;:"\\\[\]]+\.[^\s@<>(),;:"\\\[\]]+$/.test(lead.email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!/^[+\d\s().-]+$/.test(lead.phone) || lead.phone.replace(/\D/g, '').length < 7 || lead.phone.replace(/\D/g, '').length > 15) {
    throw new Error('Please enter a valid phone number.');
  }
  if (typeof body.submissionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.submissionId)) throw new Error('Please refresh the page and try again.');
  lead.submissionId = body.submissionId;
  return lead;
}

export function createHandler({ env = process.env, fetcher = globalThis.fetch } = {}) {
  return async function handler(req, res) {
    const reply = (status, body) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(status).json(body);
    };
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return reply(405, { ok: false, error: 'Method not allowed.' });
    }
    const origins = [...DEFAULT_ORIGINS, ...(env.CONTACT_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)];
    if (req.method === 'POST' && !origins.includes(req.headers.origin)) {
      return reply(403, { ok: false, error: 'Please submit through getfirstprinciple.com.' });
    }
    const configured = env.CONTACT_SCRIPT_URL && env.CONTACT_SHARED_SECRET?.length >= 32 && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY;
    if (!configured) return reply(503, { ok: false, error: 'The form is temporarily unavailable. Please email founder@getfirstprinciple.com.' });
    if (req.method === 'GET') return reply(200, { siteKey: env.TURNSTILE_SITE_KEY });
    if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return reply(415, { ok: false, error: 'Invalid form format.' });
    }
    let body, lead;
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || Buffer.byteLength(raw, 'utf8') > 16000) return reply(413, { ok: false, error: 'Your message is too long.' });
      body = JSON.parse(raw);
      lead = validateLead(body);
    } catch (error) {
      return reply(400, { ok: false, error: error instanceof SyntaxError ? 'Invalid form.' : error.message });
    }
    if (lead.company) return reply(200, { ok: true }); // Honeypot; no sheet row or email.
    if (typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) {
      return reply(400, { ok: false, error: 'Please complete the quick security check.' });
    }
    try {
      const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken }),
        signal: AbortSignal.timeout(8000)
      });
      if (!verification.ok) throw new Error('Verification unavailable');
      const challenge = await verification.json();
      const hostnames = origins.map(origin => new URL(origin).hostname);
      if (challenge.success !== true || challenge.action !== 'contact' || !hostnames.includes(challenge.hostname)) {
        return reply(400, { ok: false, error: 'The security check expired. Please try again.' });
      }
      // Keep redirects enabled: Apps Script ContentService redirects its JSON response.
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.CONTACT_SCRIPT_URL)) throw new Error('Invalid configuration');
      const upstream = await fetcher(env.CONTACT_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.CONTACT_SHARED_SECRET, lead }),
        redirect: 'follow',
        signal: AbortSignal.timeout(20000)
      });
      if (!upstream.ok) throw new Error('Submission unavailable');
      const result = await upstream.json();
      if (result.ok !== true) throw new Error('Submission rejected');
      // Success means Google has persisted the lead, even if email needs attention.
      return reply(200, { ok: true });
    } catch {
      // Do not log contact details, credentials, or Google's response body.
      console.error('Contact submission could not be confirmed.');
      return reply(502, { ok: false, error: FAILURE });
    }
  };
}

export default createHandler();
