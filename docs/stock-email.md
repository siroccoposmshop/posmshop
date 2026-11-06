# Stock by email

IT's stock report (Excel, sheet "Stock and rolling forecast") updates POSM Shop stock automatically.

What it reads: **ProductCode** (matched to the item SKU), **Stock** → stock, and
**Stock ÷ Avg 12Mnth Sale** → months of stock. Nothing else changes. Columns are found by heading.

Safety: it only accepts the senders in `STOCK_EMAIL_SENDERS`; it changes nothing if no codes match
or fewer than half the items on sale are in the report; every run is listed on Admin → POSM Shop →
Upload, and admins get a summary email. The manual "Stock report" upload on that page does the same.

## Set up (once)

1. **Resend → Emails → Receiving**: note the receiving address (`…@<id>.resend.app`). Pick any name
   before the @, e.g. `stock@<id>.resend.app`.
2. **Resend → Webhooks → Add webhook**: URL `https://<site>/api/inbound/stock`, event `email.received`.
   Copy its signing secret (`whsec_…`).
3. **Vercel → Settings → Environment Variables** (Production), then redeploy:
   - `RESEND_WEBHOOK_SECRET` = the signing secret
   - `STOCK_EMAIL_SENDERS` = the address IT sends from, e.g. `reports@mmi.ae` (comma-separate several, or `@mmi.ae` for a whole domain)
   - optional `STOCK_EMAIL_NOTIFY` = who gets the result email (default: every POSM admin)
4. Ask IT to add the receiving address to the report's recipients.
5. Send a test: forward one report from an allowed address, then check Upload → Stock feed.
