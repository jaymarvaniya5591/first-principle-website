# First Principle enquiries and Heimdall acknowledgments

## What this adds

Keep the current website form. A small Vercel function verifies the submission and passes it privately to Google Apps Script. The script saves the enquiry in a Google Sheet, then sends the personalised acknowledgment through your existing Google Workspace account.

No Google Form embed, paid form provider, separate server, or database is needed. Google Sheets is the enquiry register. Your Workspace and Vercel subscription costs still apply; the Google script and Turnstile do not add a subscription fee within their quotas.

**The code is prepared locally. Account configuration and deployment are still required. No live email has been sent as part of these checks.**

## 1. Enable Heimdall as a sender

Use the Google Workspace account that will own the sheet and script, preferably founder@getfirstprinciple.com.

- If heimdall@getfirstprinciple.com is already a mailbox, you can instead create and deploy the script while signed in to that mailbox.
- Otherwise, add `heimdall` as an alternate address for the founder in Google Admin. A Workspace alias does not require another paid mailbox.
- In the founder's Gmail, go to **Settings → See all settings → Accounts → Send mail as → Add another email address**. Add `Heimdall at First Principle` and `heimdall@getfirstprinciple.com`, completing any verification Google requests.
- Ensure you can select Heimdall in Gmail's From field. The script checks this during setup and refuses to impersonate an unconfigured sender.

References: [Workspace aliases](https://support.google.com/a/answer/33327) · [Gmail send-as](https://support.google.com/mail/answer/22370).

## 2. Create the enquiry sheet and script

1. In that Workspace account, create a Google Sheet named **First Principle — Enquiries**. Keep access restricted to your team.
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the supplied `Code.gs` file and save.
4. Open **Project Settings → Script properties**. Add `CONTACT_SHARED_SECRET` with a random value of at least 32 characters, generated with a password manager. Keep it private; you will paste the same value in Vercel.
5. Select the `setup` function and click **Run**. Authorise the sheet, Gmail and trigger permissions. This creates the Enquiries tab and a five-minute queue trigger. Setup itself sends no email.
6. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`.

Use the `/exec` deployment URL, not the editor-only `/dev` URL. Although the web endpoint accepts public connections, it only saves/sends when the server-held shared secret matches. The browser never receives that secret or the script URL.

If your Workspace administrator disallows public web apps, they must allow this deployment or you will need the Vercel + Resend alternative instead. Do not make the spreadsheet public.

When you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version → Deploy**. Saving the editor alone does not update the deployed version.

## 3. Add the free spam check

Create a [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) widget, choose **Managed**, and allow `getfirstprinciple.com` and `www.getfirstprinciple.com`.

Copy its site key and secret key. This does not require moving your domain or DNS to Cloudflare. The widget loads only when a visitor interacts with the form. Server verification is mandatory; missing configuration never silently enables an unprotected mail-sending endpoint.

Reference: [Turnstile free plan](https://developers.cloudflare.com/turnstile/plans/).

## 4. Connect Vercel

In the existing website project, open **Settings → Environment Variables** and add these for Production:

| Name | Value |
| --- | --- |
| `CONTACT_SCRIPT_URL` | Your Google web app URL ending in `/exec` |
| `CONTACT_SHARED_SECRET` | Exactly the same private value as the Google script property |
| `TURNSTILE_SITE_KEY` | Turnstile's public site key |
| `TURNSTILE_SECRET_KEY` | Turnstile's private secret key |

Optional: to use a specific Vercel preview URL, add its full origin to `CONTACT_ALLOWED_ORIGINS`, and allow its hostname in Turnstile. Separate multiple origins with commas. Never use a wildcard. Use a separate Google sheet/script for preview if you want test enquiries kept out of production.

Keep these values in Vercel settings. Do not paste secrets into HTML, browser JavaScript, GitHub, or the example environment file.

## 5. Publish and check once

The active repository is:

`C:\Users\marva\Documents\First Principle\first-principle-website\first-principle-website`

This is the current copy connected to `jaymarvaniya5591/first-principle-website`; the separate `Website code` folder contains an older copy.

After the settings above are ready, commit and push the prepared changes to the connected GitHub branch. Vercel should deploy them. If you change environment variables after deployment, redeploy.

For this plain HTML project, keep Framework set to **Other**, and the existing static output configuration. The `api/contact.js` file is deployed as a Vercel Node function; no frontend build or new runtime package is needed. Use a current supported Node runtime (22 or newer).

Submit one genuine test enquiry using an email address you control. Check all three places:

- The website confirms receipt only after the sheet save is confirmed.
- The **Enquiries** tab contains the name, email, phone and message.
- The visitor receives the formatted acknowledgment, with the founder copied in. Check Gmail Sent and the recipient's inbox/spam folder.

Test both a first-name-only and a last-name-only entry. Empty/whitespace-only names must be rejected. The existing phone/email requirements stay in place; the message stays optional.

## Email behaviour

| Field | Value |
| --- | --- |
| From | Heimdall at First Principle &lt;heimdall@getfirstprinciple.com&gt; |
| To | Visitor's email address |
| CC | founder@getfirstprinciple.com |
| Reply-To | founder@getfirstprinciple.com |
| Subject | Jay, your message made it. \| First Principle |
| Greeting | First name if supplied; otherwise last name |

Each email includes the enquiry details so the founder has the full context in the same conversation. As founder, use **Reply all** to answer the visitor in that thread. A visitor's ordinary Reply goes to the founder. If the visitor email is the founder address itself, the redundant CC is omitted.

The design uses inline styles, presentation tables, a plain-text alternative, and `'Helvetica Neue', Helvetica, Arial, sans-serif`. It references the site's existing Helvetica Neue files for email apps that support webfonts. Apps that block webfonts use an installed Helvetica Neue or the fallback font. A browser preview is provided; exact rendering can differ by email app.

## Reliability and sheet statuses

- **PENDING:** The enquiry has been saved. The automatic trigger retries this queue every five minutes, up to ten rows per run. A missing sender configuration or exhausted daily quota leaves the enquiry here with a note.
- **SENT:** Gmail accepted the sending request. This is not a guarantee of inbox delivery; a bounce or spam filtering can still occur.
- **SENDING:** The script persisted the send attempt before calling Gmail. If execution is interrupted, the next trigger marks it REVIEW.
- **REVIEW:** Sending failed or its outcome was uncertain. Check Gmail Sent before retrying. If already sent, mark the row SENT. If definitely unsent, change only Email status to PENDING to queue it again. Keep the hidden Payload column and Submission ID intact.

Repeated attempts of the same unchanged form in the same browser page reuse a submission ID. Google avoids a duplicate row/email for that ID. A page reload or deliberately new enquiry can receive a new ID. Sending and writing a sheet row are separate operations, so exactly-once email delivery cannot be guaranteed; uncertain sends require review instead of automatic duplication.

There are no permanent customer records on Vercel and no enquiry content is written to its logs by this handler. The Google Sheet and Gmail mailbox contain the enquiries; handle their access and retention as your normal customer correspondence. Turnstile processes the browser security check.

## Free limits and alternatives

Google currently lists 1,500 email recipients/day for paid Workspace Apps Script accounts and 100/day for consumer Gmail accounts. Counting both visitor and founder conservatively gives roughly 750 acknowledgments/day for a normal Workspace account, before other script usage. Trial/new-account restrictions and associated Gmail limits can be lower. The script checks remaining quota and leaves enquiries queued when it is insufficient.

[Google quotas](https://developers.google.com/apps-script/guides/services/quotas) · [Google web app deployment](https://developers.google.com/apps-script/guides/web)

A Google Form is a simple option if you want Google's own form interface; branded personalised sending still needs a script. Formspree's custom email and domain features require a paid plan. If you later want an email service independent of Workspace, use Vercel + Resend; its free plan currently allows 3,000 recipient emails/month and 100/day, counting CC recipients separately.

[Formspree plans](https://formspree.io/plans/) · [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)

## Local checks already available

- `npm run test:contact` tests validation, secret protection, bot verification, saved-first behaviour, retry deduplication, sending headers, queue handling and escaped email content with mocked external services.
- `npm run preview:email` renders the actual script template to `.work/email-preview` without sending.
- The normal static preview (`npm run serve`) previews the page only. It does not execute the Vercel function. Use a configured Vercel preview deployment for an end-to-end account test.

Live Google authorisation, real inbox delivery, and the deployed Vercel function still need the account setup and final test above.
