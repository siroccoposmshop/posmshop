# Setup still to do (IT / admin)

Things built in the site that switch on once IT and the email setup are done. Tick them off as they're finished.

## Email
- [ ] **sirocco.ae verified in Resend** (IT adds the DKIM TXT record and the two CNAMEs Resend shows).
- [ ] **posm@sirocco.ae as the sender**: Vercel `EMAIL_FROM` = `POSM SHOP <posm@sirocco.ae>`, redeploy; Supabase → Auth → SMTP sender = posm@sirocco.ae. Then place a test order (KAM + CShelpdeskMMI@mmi.ae get one email with the Excel; the customer gets theirs).
- [ ] **projects@sirocco.ae** created by IT; Vercel `PROJECTS_EMAIL_FROM` = `Commerce Hub <projects@sirocco.ae>`, redeploy.
- [ ] **Supabase email templates** re-pasted with the Commerce Hub versions (Authentication → Emails: Magic Link, Confirm signup, Invite user) and their subjects, from `supabase/templates/`.

## Scheduled jobs
- [ ] **CRON_SECRET** in Vercel (any ~32-character random password, Production), redeploy. Needed for the Monday project digest (incl. PICOS to deliver) and the Salesforce nightly sync.

## Stock feed by email (see `docs/stock-email.md`)
- [ ] IT runs the stock report for the **POSM range** (ProductCode = the site's SKUs, e.g. HKN08). The sample had Drink Dynasty codes only.
- [ ] Resend → Receiving address noted (`stock@<id>.resend.app`).
- [ ] Resend → Webhook `https://posmshop.vercel.app/api/inbound/stock`, event `email.received`.
- [ ] Vercel `RESEND_WEBHOOK_SECRET` and `STOCK_EMAIL_SENDERS` (IT's sending address), redeploy.
- [ ] IT adds the receiving address to the report's recipients; send one test and check Upload → Stock feed.
- [ ] Optional next step: ETAs from the report's incoming columns (Mnth0_IN… / order dates).

## Salesforce
- [ ] IT provides the connected app: Vercel `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET` (domain `https://mmielr.my.salesforce.com`), redeploy.
- [ ] Company-code list per market (Admin → Markets; Dubai = M10).
- [ ] Later: PICOS scores pulled from Salesforce instead of entered by hand.

Never paste secrets into chat: add them straight into Vercel.
