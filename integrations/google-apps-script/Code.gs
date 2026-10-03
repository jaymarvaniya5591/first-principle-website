/** First Principle contact inbox. Paste this entire file into a sheet-bound Apps Script. */
const FP = {
  sender: 'heimdall@getfirstprinciple.com',
  founder: 'founder@getfirstprinciple.com',
  sheet: 'Enquiries',
  headers: ['Submission ID', 'Received at', 'First name', 'Last name', 'Email', 'Phone', 'Message', 'Email status', 'Sent at', 'Attempts', 'Note', 'Payload']
};

// Run once from the sheet's Apps Script editor. This does not send any email.
function setup() {
  const props = PropertiesService.getScriptProperties();
  if ((props.getProperty('CONTACT_SHARED_SECRET') || '').length < 32) {
    throw new Error('Add CONTACT_SHARED_SECRET (at least 32 random characters) in Project Settings → Script properties.');
  }
  senderOptions_(); // Confirm Heimdall is a mailbox or verified Gmail send-as alias.
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Open Apps Script from Extensions in your enquiry spreadsheet.');
  props.setProperty('CONTACT_SHEET_ID', book.getId());
  const sheet = book.getSheetByName(FP.sheet) || book.insertSheet(FP.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FP.headers);
    sheet.getRange(1, 1, 1, FP.headers.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(3, 5, 180);
    sheet.setColumnWidth(7, 350);
    sheet.hideColumns(12);
  }
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sendPendingAcknowledgments')) {
    ScriptApp.newTrigger('sendPendingAcknowledgments').timeBased().everyMinutes(5).create();
  }
  console.log('Setup complete. Deploy as a web app: Execute as Me; access Anyone.');
}

function doGet() {
  return json_({ ok: false, error: 'Submit through getfirstprinciple.com.' });
}

function doPost(event) {
  let lock;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 16000) return json_({ ok: false });
    const request = JSON.parse(raw);
    const secret = PropertiesService.getScriptProperties().getProperty('CONTACT_SHARED_SECRET');
    if (!secret || secret.length < 32 || request.secret !== secret) return json_({ ok: false });
    const lead = validateLead_(request.lead);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return json_({ ok: false });
    const sheet = sheet_();
    const count = sheet.getLastRow() - 1;
    const existing = count > 0 ? sheet.getRange(2, 1, count, 1).createTextFinder(lead.submissionId).matchEntireCell(true).findNext() : null;
    if (existing) {
      const stored = JSON.parse(sheet.getRange(existing.getRow(), 12).getValue());
      // A reused ID with different contents is never treated as a successful save.
      return json_({ ok: JSON.stringify(stored) === JSON.stringify(lead) });
    }
    sheet.appendRow([lead.submissionId, new Date(), safeCell_(lead.firstName), safeCell_(lead.lastName),
      safeCell_(lead.email), safeCell_(lead.phone), safeCell_(lead.message), 'PENDING', '', 0, '', JSON.stringify(lead)]);
    SpreadsheetApp.flush(); // The lead must be durable before acknowledging the request.
    // A scheduled trigger also picks up PENDING rows if this request ends early.
    try { sendRow_(sheet, sheet.getLastRow(), lead); } catch (_) { /* Saved; sheet status is the source of truth. */ }
    return json_({ ok: true });
  } catch (_) {
    return json_({ ok: false });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function validateLead_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid form');
  const lead = {};
  const limits = { firstName: 80, lastName: 80, email: 254, phone: 40, message: 4000 };
  Object.keys(limits).forEach(key => {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error('Invalid field');
    lead[key] = (input[key] || '').trim();
    if (lead[key].length > limits[key] || (key !== 'message' && /[\x00-\x1f\x7f]/.test(lead[key]))) throw new Error('Invalid field');
  });
  if (!lead.firstName && !lead.lastName) throw new Error('A name is required');
  if (!/^[^\s@<>(),;:"\\\[\]]+@[^\s@<>(),;:"\\\[\]]+\.[^\s@<>(),;:"\\\[\]]+$/.test(lead.email)) throw new Error('Invalid email');
  if (!/^[+\d\s().-]+$/.test(lead.phone) || lead.phone.replace(/\D/g, '').length < 7 || lead.phone.replace(/\D/g, '').length > 15) throw new Error('Invalid phone');
  if (typeof input.submissionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.submissionId)) throw new Error('Invalid ID');
  lead.submissionId = input.submissionId;
  return lead;
}

function senderOptions_() {
  const owner = Session.getEffectiveUser().getEmail().toLowerCase();
  if (owner === FP.sender) return {};
  const aliases = GmailApp.getAliases().map(address => address.toLowerCase());
  if (!aliases.includes(FP.sender)) throw new Error('Add heimdall@getfirstprinciple.com as a verified Gmail send-as alias, or deploy from that mailbox.');
  return { from: FP.sender };
}

function sendRow_(sheet, row, lead) {
  let sender;
  try {
    sender = senderOptions_();
    if (MailApp.getRemainingDailyQuota() < (lead.email.toLowerCase() === FP.founder ? 1 : 2)) {
      sheet.getRange(row, 11).setValue('Waiting for daily email quota; retries automatically.');
      return;
    }
  } catch (_) {
    sheet.getRange(row, 11).setValue('Check sender alias and script permissions; retries automatically.');
    return;
  }
  const email = buildAcknowledgment_(lead);
  const attempts = Number(sheet.getRange(row, 10).getValue()) || 0;
  // Persist before sending. An interrupted send is reviewed instead of blindly repeated.
  sheet.getRange(row, 8).setValue('SENDING');
  sheet.getRange(row, 10).setValue(attempts + 1);
  SpreadsheetApp.flush();
  try {
    const options = Object.assign({}, sender, {
      name: 'Heimdall at First Principle', htmlBody: email.html, replyTo: FP.founder
    });
    if (lead.email.toLowerCase() !== FP.founder) options.cc = FP.founder;
    GmailApp.sendEmail(lead.email, email.subject, email.text, options);
  } catch (_) {
    sheet.getRange(row, 8).setValue('REVIEW');
    sheet.getRange(row, 11).setValue('Sending could not be confirmed. Check Gmail Sent before manually retrying.');
    return;
  }
  sheet.getRange(row, 8, 1, 4).setValues([['SENT', new Date(), attempts + 1, '']]);
  SpreadsheetApp.flush();
}

// Installed by setup(). Only unsent PENDING rows are retried automatically.
function sendPendingAcknowledgments() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const sheet = sheet_();
    const rows = sheet.getDataRange().getValues();
    let attempted = 0;
    for (let i = 1; i < rows.length && attempted < 10; i++) {
      if (rows[i][7] === 'SENDING') {
        // No send is active while this lock is held: a previous run was interrupted.
        sheet.getRange(i + 1, 8).setValue('REVIEW');
        sheet.getRange(i + 1, 11).setValue('Previous send was interrupted. Check Gmail Sent before manually retrying.');
      } else if (rows[i][7] === 'PENDING') {
        attempted++;
        sendRow_(sheet, i + 1, validateLead_(JSON.parse(rows[i][11])));
      }
    }
  } finally { lock.releaseLock(); }
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('CONTACT_SHEET_ID');
  if (!id) throw new Error('Run setup first');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(FP.sheet);
  if (!sheet) throw new Error('Missing enquiry sheet');
  return sheet;
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function safeCell_(value) { return /^[=+\-@]/.test(value) ? "'" + value : value; }
function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

// This is also the source used to generate the browser preview. All visitor text is escaped.
function buildAcknowledgment_(lead) {
  const name = lead.firstName || lead.lastName;
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const note = lead.message || 'No message added — we’ll start with a hello.';
  const subject = name + ', your message made it. | First Principle';
  const text = `FIRST PRINCIPLE\nMESSAGE RECEIVED\n\nYour message made it.\n\nHi ${name},\n\nI’m Heimdall, First Principle’s inbox lookout. Your enquiry is safely with us, and a real human will be back in touch soon.\n\nI’ve copied our founder in, so your question already has good company.\n\nWhether you’re choosing a smart toilet, planning a bathroom, or just curious about what we’re building, we’ll help you figure out the next step.\n\nOne more detail? Hit reply. It goes straight to our founder.\n\nHeimdall\nOn inbox duty at First Principle\n\nYOUR ENQUIRY\nName: ${fullName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\n\n${note}\n\nSmart toilets. Human conversations.\nhttps://getfirstprinciple.com\n\nThis is an automatic acknowledgment of your website enquiry.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml_(subject)}</title>
<!--[if !mso]><!--><style>@font-face{font-family:'Helvetica Neue';font-style:normal;font-weight:400;src:url('https://www.getfirstprinciple.com/assets/fonts/helvetica-neue-400.woff2') format('woff2')}@font-face{font-family:'Helvetica Neue';font-style:normal;font-weight:500 700;src:url('https://www.getfirstprinciple.com/assets/fonts/helvetica-neue-500.woff2') format('woff2')}</style><!--<![endif]-->
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media only screen and (max-width:600px){.outer{padding:16px 8px!important}.pad{padding-left:26px!important;padding-right:26px!important}.headline{font-size:42px!important;line-height:44px!important}.hero{padding-top:38px!important;padding-bottom:38px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#eeeeee;color:#111111;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;color:#eeeeee;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Hi ${escapeHtml_(name)}. Your enquiry is with us. A real human will be in touch soon.</div>
<table role="presentation" width="100%" bgcolor="#eeeeee"><tr><td class="outer" align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #dedede;" bgcolor="#ffffff">
<tr><td class="pad" style="padding:28px 44px;border-bottom:1px solid #dedede;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<a href="https://getfirstprinciple.com" style="font-size:15px;line-height:20px;font-weight:700;letter-spacing:3px;color:#111111;text-decoration:none;">FIRST PRINCIPLE<span style="letter-spacing:0;">.</span></a>
</td></tr>
<tr><td class="pad hero" bgcolor="#111111" style="padding:44px;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<p style="margin:0 0 28px;font-size:10px;line-height:16px;font-weight:500;letter-spacing:2.5px;color:#cccccc;">MESSAGE RECEIVED &nbsp; / &nbsp; HEIMDALL ON DUTY</p>
<h1 class="headline" style="margin:0;font-size:54px;line-height:55px;letter-spacing:-2.3px;font-weight:500;color:#ffffff;">Your message<br>made it.</h1>
<p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#cccccc;">Good questions deserve real answers.</p>
</td></tr>
<tr><td class="pad" style="padding:36px 44px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#333333;overflow-wrap:anywhere;word-break:break-word;">
<p style="margin:0 0 20px;font-size:22px;line-height:30px;color:#111111;font-weight:500;">Hi ${escapeHtml_(name)},</p>
<p style="margin:0 0 18px;">I’m Heimdall, First Principle’s inbox lookout. Your enquiry is safely with us, and a real human will be back in touch soon.</p>
<p style="margin:0 0 18px;">I’ve copied our founder in, so your question already has good company.</p>
<p style="margin:0 0 22px;">Whether you’re choosing a smart toilet, planning a bathroom, or just curious about what we’re building, we’ll help you figure out the next step.</p>
<p style="margin:0 0 28px;font-size:14px;line-height:23px;">One more detail? <a href="mailto:founder@getfirstprinciple.com" style="color:#111111;text-decoration:underline;">Hit reply.</a> It goes straight to our founder.</p>
<p style="margin:0;color:#111111;font-size:17px;line-height:24px;font-weight:600;">Heimdall</p>
<p style="margin:2px 0 0;font-size:12px;line-height:20px;color:#777777;">On inbox duty at First Principle</p>
</td></tr>
<tr><td class="pad" style="padding:0 44px 34px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" style="border-top:1px solid #dedede;"><tr><td style="padding:24px 0 0;overflow-wrap:anywhere;word-break:break-word;">
<p style="margin:0 0 14px;font-size:10px;line-height:16px;font-weight:600;letter-spacing:2px;color:#777777;">YOUR ENQUIRY</p>
<p style="margin:0 0 5px;font-size:13px;line-height:21px;color:#555555;">${escapeHtml_(fullName)}<br>${escapeHtml_(lead.email)}<br>${escapeHtml_(lead.phone)}</p>
<p style="margin:14px 0 0;font-size:14px;line-height:23px;color:#333333;">${escapeHtml_(note).replace(/\r?\n/g, '<br>')}</p>
</td></tr></table>
</td></tr>
<tr><td class="pad" bgcolor="#111111" style="padding:26px 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<p style="margin:0 0 8px;font-size:15px;line-height:23px;color:#ffffff;font-weight:500;">Smart toilets. Human conversations.</p>
<a href="https://getfirstprinciple.com" style="font-size:12px;line-height:20px;color:#bbbbbb;text-decoration:none;">getfirstprinciple.com &nbsp; ↗</a>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="max-width:520px;margin:20px auto 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:18px;color:#777777;text-align:center;">This is an automatic acknowledgment of your website enquiry.<br>A thoughtful reply from our team comes next.</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}
