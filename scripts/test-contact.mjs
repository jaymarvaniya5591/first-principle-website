import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createHandler, validateLead } from '../api/contact.js';

const lead = { firstName: 'Jay', lastName: '', email: 'jay@example.com', phone: '+91 90000 00000', message: 'Tell me more.',
  company: '', submissionId: '4b8013d5-cf64-48f9-8c5e-7c2ea18df1a1' };
const env = { CONTACT_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec', CONTACT_SHARED_SECRET: 'test-secret-that-is-at-least-32-characters', TURNSTILE_SITE_KEY: 'public-key', TURNSTILE_SECRET_KEY: 'private-key' };
const source = readFileSync(new URL('../integrations/google-apps-script/Code.gs', import.meta.url), 'utf8');

function app({ quota = 1500, failSend = false, aliases = ['heimdall@getfirstprinciple.com'] } = {}) {
  const rows = [['Submission ID', 'Received at', 'First', 'Last', 'Email', 'Phone', 'Message', 'Status', 'Sent at', 'Attempts', 'Note', 'Payload']];
  const sent = [];
  let locked = false;
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    getRange(row, col, height = 1, width = 1) {
      return {
        getRow: () => row,
        getValue: () => rows[row - 1][col - 1],
        setValue(value) { rows[row - 1][col - 1] = value; },
        setValues(values) { for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows[row + y - 1][col + x - 1] = values[y][x]; },
        createTextFinder(value) { return { matchEntireCell() { return this; }, findNext() {
          const index = rows.findIndex((r, i) => i >= row - 1 && i < row - 1 + height && r[col - 1] === value);
          return index < 0 ? null : { getRow: () => index + 1 };
        } }; }
      };
    }
  };
  const props = { CONTACT_SHARED_SECRET: env.CONTACT_SHARED_SECRET, CONTACT_SHEET_ID: 'sheet-id' };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { locked = true; return true; }, hasLock: () => locked, releaseLock: () => { locked = false; } }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'founder@getfirstprinciple.com' }) },
    GmailApp: { getAliases: () => aliases, sendEmail(...args) { if (failSend) throw new Error('Mail unavailable'); sent.push(args); } },
    MailApp: { getRemainingDailyQuota: () => quota },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) }
  });
  vm.runInContext(source, context);
  return { context, rows, sent, post: (value = lead, secret = env.CONTACT_SHARED_SECRET) => context.doPost({ postData: { contents: JSON.stringify({ secret, lead: value }) } }) };
}

async function request({ method = 'POST', data = { ...lead, turnstileToken: 'token' }, origin = 'https://getfirstprinciple.com', config = env, challenge = { success: true, hostname: 'getfirstprinciple.com', action: 'contact' }, upstream = { ok: true }, fail = false, type = 'application/json' } = {}) {
  const calls = [];
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await createHandler({ env: config, fetcher: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    if (fail) throw new Error('Network failed');
    return { ok: true, json: async () => calls.length === 1 ? challenge : upstream };
  } })({ method, body: data, headers: { origin, 'content-type': type } }, res);
  return { ...res, headers, calls };
}

test('Either name is accepted; both empty or whitespace are rejected on both servers', () => {
  const google = app().context;
  for (const names of [{ firstName: 'Jay', lastName: '' }, { firstName: '', lastName: 'Marvaniya' }, { firstName: 'Jay', lastName: 'Marvaniya' }]) {
    assert.doesNotThrow(() => validateLead({ ...lead, ...names }));
    assert.doesNotThrow(() => google.validateLead_({ ...lead, ...names }));
  }
  for (const validator of [validateLead, google.validateLead_]) {
    assert.throws(() => validator({ ...lead, firstName: ' ', lastName: '\t' }));
    assert.throws(() => validator({ ...lead, email: 'jay@example.com,bcc@example.com' }));
    assert.throws(() => validator({ ...lead, firstName: 'Jay\nBcc: other@example.com' }));
    assert.throws(() => validator({ ...lead, phone: '123' }));
    assert.throws(() => validator({ ...lead, message: 'a'.repeat(4001) }));
    assert.throws(() => validator({ ...lead, firstName: ['Jay'] }));
  }
});
test('Public configuration exposes only the public Turnstile key', async () => {
  const result = await request({ method: 'GET' });
  assert.deepEqual(result.body, { siteKey: 'public-key' });
  assert.equal(result.calls.length, 0);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('Allowed request is bot-checked before forwarding with the private shared secret', async () => {
  const result = await request();
  assert.equal(result.code, 200);
  assert.equal(result.calls.length, 2);
  assert.equal(result.calls[1].body.secret, env.CONTACT_SHARED_SECRET);
  assert.equal(result.calls[1].body.lead.firstName, 'Jay');
  assert.equal(result.calls[1].body.lead.turnstileToken, undefined);
});
test('Wrong origin, missing configuration, non-JSON, invalid input and large payloads fail closed', async () => {
  for (const [settings, expected] of [[{ origin: 'https://evil.example' }, 403], [{ config: {} }, 503], [{ type: 'text/plain' }, 415], [{ data: null }, 400], [{ data: { ...lead, message: 'x'.repeat(17000) } }, 413], [{ method: 'DELETE' }, 405]]) {
    const result = await request(settings);
    assert.equal(result.code, expected);
    assert.equal(result.calls.length, 0);
  }
});
test('Honeypot and invalid challenge cannot send email or save a lead', async () => {
  assert.equal((await request({ data: { ...lead, company: 'bot' } })).calls.length, 0);
  for (const challenge of [{ success: false }, { success: true, hostname: 'evil.example', action: 'contact' }, { success: true, hostname: 'getfirstprinciple.com', action: 'login' }]) {
    const result = await request({ challenge });
    assert.equal(result.code, 400);
    assert.equal(result.calls.length, 1);
  }
  assert.equal((await request({ data: lead })).code, 400);
});
test('No false success when Google rejects the save or the network fails', async () => {
  assert.equal((await request({ upstream: { ok: false } })).code, 502);
  assert.equal((await request({ fail: true })).code, 502);
});
test('Google authenticates before writing and persists before sending with requested headers', () => {
  const google = app();
  assert.equal(google.post(lead, 'wrong').ok, false);
  assert.equal(google.rows.length, 1);
  assert.equal(google.post().ok, true);
  assert.equal(google.rows.length, 2);
  assert.equal(google.rows[1][7], 'SENT');
  const [to, subject, text, options] = google.sent[0];
  assert.equal(to, lead.email);
  assert.equal(options.from, 'heimdall@getfirstprinciple.com');
  assert.equal(options.name, 'The front Desk');
  assert.equal(options.cc, 'founder@getfirstprinciple.com');
  assert.equal(options.replyTo, 'founder@getfirstprinciple.com');
  assert.match(subject, /^Jay,/);
  assert.ok(text.includes(lead.phone) && options.htmlBody.includes(lead.message));
});
test('Retries of the same submission do not duplicate the row or email; changed payload is rejected', () => {
  const google = app();
  google.post();
  assert.equal(google.post().ok, true);
  assert.equal(google.rows.length, 2);
  assert.equal(google.sent.length, 1);
  assert.equal(google.post({ ...lead, message: 'Changed' }).ok, false);
});
test('Quota exhaustion or missing sender retains the lead for automatic retry', () => {
  for (const settings of [{ quota: 0 }, { aliases: [] }]) {
    const google = app(settings);
    assert.equal(google.post().ok, true);
    assert.equal(google.rows[1][7], 'PENDING');
    assert.equal(google.sent.length, 0);
  }
});
test('An ambiguous sending error is preserved for review and is never blindly retried', () => {
  const google = app({ failSend: true });
  assert.equal(google.post().ok, true);
  assert.equal(google.rows[1][7], 'REVIEW');
  google.context.sendPendingAcknowledgments();
  assert.equal(google.rows[1][9], 1);
});
test('Queue sends pending rows and flags interrupted sends', () => {
  const google = app({ quota: 0 });
  google.post();
  google.context.MailApp.getRemainingDailyQuota = () => 1500;
  google.context.sendPendingAcknowledgments();
  assert.equal(google.rows[1][7], 'SENT');
  google.rows[1][7] = 'SENDING';
  google.context.sendPendingAcknowledgments();
  assert.equal(google.rows[1][7], 'REVIEW');
  assert.equal(google.sent.length, 1);
});
test('Email uses last-name fallback, escapes visitor HTML and preserves plain text', () => {
  const google = app().context;
  const email = google.buildAcknowledgment_({ ...lead, firstName: '', lastName: 'O\'Brien <img src=x>', message: '<script>alert(1)</script>\n& thank you' });
  assert.ok(email.html.includes('Hi O&#39;Brien &lt;img src=x&gt;,'));
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('&amp; thank you'));
  assert.ok(email.text.includes('<script>alert(1)</script>'));
  assert.match(email.html, /Helvetica Neue/);
  const introduction = 'I’m Heimdall, keeping watch over the First Principle inbox. Your enquiry is with us, and someone from our team will be in touch soon.';
  assert.ok(email.text.includes(introduction));
  assert.ok(email.html.includes(introduction));
  assert.ok(!email.text.includes('inbox lookout'));
  assert.equal(google.safeCell_('=IMPORTXML("bad")'), '\'=IMPORTXML("bad")');
});
