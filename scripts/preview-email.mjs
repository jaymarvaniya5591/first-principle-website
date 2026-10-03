// Renders the actual Apps Script email without calling Google or sending email.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../integrations/google-apps-script/Code.gs', import.meta.url), 'utf8'), context);
const lead = { firstName: 'Jay', lastName: 'Marvaniya', email: 'jay@example.com', phone: '+91 90000 00000',
  message: 'Hi! I’m planning a new bathroom and would love to understand which smart toilet would be the right fit.' };
const email = context.buildAcknowledgment_(lead);
const output = path.resolve(process.argv[2] || '.work/email-preview');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'heimdall-email-preview.html'), email.html);
const senderName = vm.runInContext('FP.senderName', context);
await writeFile(path.join(output, 'heimdall-email-content.txt'), `From: ${senderName} <heimdall@getfirstprinciple.com>\nTo: ${lead.email}\nCc: founder@getfirstprinciple.com\nReply-To: founder@getfirstprinciple.com\nSubject: ${email.subject}\n\n${email.text}\n`);
console.log('Email preview saved to ' + output + '. No email sent.');
