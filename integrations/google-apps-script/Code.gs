/** First Principle contact inbox. Paste this entire file into a sheet-bound Apps Script. */
const FP = {
  sender: 'heimdall@getfirstprinciple.com',
  senderName: 'The front Desk',
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
      name: FP.senderName, htmlBody: email.html, replyTo: FP.founder
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
  const introduction = 'I’m Heimdall, keeping watch over the First Principle inbox. Your enquiry is with us, and someone from our team will be in touch soon.';
  const text = `FIRST PRINCIPLE\nMESSAGE RECEIVED\n\nYour message made it.\n\nHi ${name},\n\n${introduction}\n\nI’ve copied our founder in, so your question already has good company.\n\nWhether you’re choosing a smart toilet, planning a bathroom, or just curious about what we’re building, we’ll help you figure out the next step.\n\nOne more detail? Hit reply. It goes straight to our founder.\n\nHeimdall\nOn inbox duty at First Principle\n\nYOUR ENQUIRY\nName: ${fullName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\n\n${note}\n\nSmart toilets. Human conversations.\nhttps://getfirstprinciple.com\n\nThis is an automatic acknowledgment of your website enquiry.`;
  // A unique webfont family avoids selecting a locally installed Helvetica Neue
  // Black face when Gmail removes @font-face. Those clients use regular Arial.
  const font = "font-family:'FP Helvetica Neue',Arial,Helvetica,sans-serif;";
  const normal = font + 'font-size:16px;line-height:25px;font-weight:400;';
  const phoneLink = lead.phone.replace(/[^+\d]/g, '');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml_(subject)}</title>
<!--[if !mso]><!--><style>@font-face{font-family:'FP Helvetica Neue';font-style:normal;font-weight:400;src:url('https://www.getfirstprinciple.com/assets/fonts/helvetica-neue-400.woff2') format('woff2')}@font-face{font-family:'FP Helvetica Neue';font-style:normal;font-weight:700;src:url('https://www.getfirstprinciple.com/assets/fonts/helvetica-neue-500.woff2') format('woff2')}</style><!--<![endif]-->
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media screen and (min-width:601px){.outer{padding:32px 16px!important}.pad{padding-left:36px!important;padding-right:36px!important}.headline{font-size:42px!important;line-height:46px!important}.hero{padding-top:32px!important;padding-bottom:32px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f2f2f2;color:#222222;${normal}">
<div style="display:none;font-size:1px;line-height:1px;color:#f2f2f2;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Hi ${escapeHtml_(name)}. Your enquiry is with us. Someone from our team will be in touch soon.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f2f2"><tr><td class="outer" align="center" style="padding:12px 4px;${normal}">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;table-layout:fixed;background-color:#ffffff;border:1px solid #dedede;" bgcolor="#ffffff">
<tr><td class="pad" style="padding:20px;${font}font-weight:400;">
<a href="https://getfirstprinciple.com" style="${font}font-size:12px;line-height:18px;font-weight:700;letter-spacing:2px;color:#111111;text-decoration:none;">FIRST PRINCIPLE.</a>
</td></tr>
<tr><td class="pad hero" bgcolor="#111111" style="padding:26px 20px;color:#ffffff;${font}font-weight:400;">
<p style="margin:0 0 14px;${font}font-size:10px;line-height:16px;font-weight:400;letter-spacing:1.7px;color:#dddddd;">MESSAGE RECEIVED</p>
<h1 class="headline" style="margin:0;${font}font-size:32px;line-height:36px;letter-spacing:-0.8px;font-weight:700;color:#ffffff;">Your message<br>made it.</h1>
<p style="margin:14px 0 0;${font}font-size:13px;line-height:20px;font-weight:400;color:#dddddd;">Good questions deserve real answers.</p>
</td></tr>
<tr><td class="pad" style="padding:26px 20px 24px;${normal}color:#333333;overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;">
<p style="margin:0 0 16px;${font}font-size:20px;line-height:28px;color:#111111;font-weight:700;">Hi ${escapeHtml_(name)},</p>
<p style="margin:0 0 16px;${normal}">${introduction}</p>
<p style="margin:0 0 16px;${normal}">I’ve copied <strong style="font-weight:700;">our founder</strong> in, so your question already has good company.</p>
<p style="margin:0 0 18px;${normal}">Whether you’re choosing a smart toilet, planning a bathroom, or just curious about what we’re building, we’ll help you figure out the next step.</p>
<p style="margin:0 0 22px;${normal}">One more detail? <a href="mailto:founder@getfirstprinciple.com" style="${font}font-weight:700;color:#111111;text-decoration:underline;">Hit reply.</a> It goes straight to our founder.</p>
<p style="margin:0;${font}color:#111111;font-size:16px;line-height:24px;font-weight:700;">Heimdall</p>
<p style="margin:2px 0 0;${font}font-size:12px;line-height:19px;font-weight:400;color:#666666;">On inbox duty at First Principle</p>
</td></tr>
<tr><td class="pad" style="padding:0 20px 24px;${font}font-weight:400;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-top:1px solid #dedede;"><tr><td style="padding:20px 0 0;${font}font-weight:400;overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;">
<p style="margin:0 0 12px;${font}font-size:10px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#666666;">YOUR ENQUIRY</p>
<p style="margin:0 0 4px;${font}font-size:14px;line-height:22px;font-weight:700;color:#333333;">${escapeHtml_(fullName)}</p>
<p style="margin:0;${font}font-size:14px;line-height:22px;font-weight:400;color:#555555;"><a href="mailto:${escapeHtml_(lead.email)}" style="${font}font-weight:400;color:#555555;text-decoration:underline;word-break:break-all;">${escapeHtml_(lead.email)}</a><br><a href="tel:${escapeHtml_(phoneLink)}" style="${font}font-weight:400;color:#555555;text-decoration:none;">${escapeHtml_(lead.phone)}</a></p>
<p style="margin:14px 0 0;${font}font-size:14px;line-height:23px;font-weight:400;color:#333333;">${escapeHtml_(note).replace(/\r?\n/g, '<br>')}</p>
</td></tr></table>
</td></tr>
<tr><td class="pad" style="padding:20px;border-top:1px solid #dedede;${font}font-weight:400;">
<p style="margin:0 0 6px;${font}font-size:13px;line-height:21px;color:#333333;font-weight:400;">Smart toilets. Human conversations.</p>
<a href="https://getfirstprinciple.com" style="${font}font-size:12px;line-height:20px;font-weight:400;color:#555555;text-decoration:underline;">getfirstprinciple.com</a>
<p style="margin:14px 0 0;${font}font-size:11px;line-height:17px;font-weight:400;color:#666666;">This is an automatic acknowledgment of your enquiry.<br>A thoughtful reply from our team comes next.</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return { subject, text, html };
}
