# POSM SHOP

Sirocco's point-of-sale materials (POSM) ordering platform, replacing ProcX.
KAMs order POSM for their accounts. Trade Marketing runs the catalogue, stock,
users and reports.

- **Stack:** Next.js 16 (App Router) on **Vercel**, **Supabase** (Postgres, Auth, Storage), **Resend** for email.
- **Look and feel:** Sirocco Brand Guidelines 2026. Colours, Roboto Condensed + Vazirmatn, bento modules, red accent element, hyper-logotype.
- **Separate from PintFinder:** this project must live in its own GitHub, Vercel, Supabase and Resend accounts, all registered to a Sirocco email. Nothing here is shared with PintFinder.

## What it does

| Brief requirement | Where |
| --- | --- |
| Works on mobile, tablet and desktop | Responsive throughout. Sticky cart bar on mobile, brand side-slider on mobile, named brand list across the top on desktop |
| KAM + admin (Trade Marketing) logins, `@sirocco.ae` only | Email one-time code. Enforced in the UI **and** by a database trigger. Sessions persist on the device |
| Items from the "2026 POSM Budgeting" Excel, re-uploadable | Admin → Excel upload. Matches items on SKU and accounts on account number; overrides stock |
| Accounts list from the Excel, filtered by the KAM's market | Account search on the order start page (database row-level security limits KAMs to their market) |
| Contact with mobile + email | Picked from saved contacts or entered fresh, then saved to the account |
| Brand, name, SKU, category, value, image, stock | `items` table; editable in Admin → Items |
| 1200px .webp images, admin upload/remove | Single upload on the item page, or bulk upload named by SKU. Converted automatically |
| Per-order limit + order multiples (6× glasses etc.) | Quantity dropdown only offers valid quantities; the database re-checks every order |
| Stock goes down as KAMs order; Excel overrides | Done atomically in the `place_order` database function |
| Out of stock → ETA | Admin sets an ETA date; KAMs see "Expected back …" |
| Visibility per market | Market checkboxes on each item |
| Order number `POSM-<customer number>-<# from 100>` | Per-account running number starting at 100 |
| Three outputs (KAM proof, customer, Customer Service) | Three branded HTML emails sent on every order; the CS email goes to the market's mailbox (Dubai for UAE). The order page also prints / saves to PDF |
| Reports of all items used by who, filter by everything | Admin → Reports: date, market, KAM, account, brand, category, item, status. Download Excel (lines, by item, by KAM) or CSV |

## Setting it up (in order)

> Use a **Sirocco email** (e.g. the one behind the `siroccoposmshop` GitHub account) for every sign-up below, not the PintFinder one.

### 1. Supabase (database, login, image storage)
1. Sign up at <https://supabase.com> with the Sirocco email. Create an organisation (e.g. "Sirocco") and a project called `posmshop`. Choose the region closest to the Gulf that IT is happy with.
2. **SQL Editor** → paste and run `supabase/migrations/20261014000000_init.sql`.
3. Make Trade Marketing admins: in the SQL Editor run
   `insert into admin_bootstrap (email) values ('first.admin@sirocco.ae');`
   (They become admin the first time they sign in. Later admins can be added from Admin → Users.)
4. **Authentication → Sign In / Providers → Email:** enabled. Turn **off** "Allow new users to sign up" only if you want Admin → Users to be the only way in. Otherwise anyone `@sirocco.ae` can sign in and waits for a market.
5. **Authentication → Emails → Templates → Magic Link:** include the code so KAMs can type it on their phone, e.g.
   `<h2>Your POSM SHOP code</h2><p>Enter this code: <strong>{{ .Token }}</strong></p><p>Or <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">sign in with this link</a>.</p>`
6. **Authentication → Emails → SMTP settings:** connect Resend (step 3). Supabase's built-in email only sends a handful of emails per hour and isn't suitable for production.
7. **Authentication → URL Configuration:** set Site URL to the live site URL and add it to Redirect URLs.
8. **Project Settings → API Keys:** copy the Project URL, the publishable key (`sb_publishable_…`) and a secret key (`sb_secret_…`).

### 2. Vercel (hosting)
1. Sign up at <https://vercel.com> **with the Sirocco GitHub account** (`siroccoposmshop`).
2. "Add New → Project" → import `siroccoposmshop/posmshop`. Framework: Next.js (auto-detected).
3. Add the environment variables from `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.
4. Deploy. Optionally add a domain such as `posm.sirocco.ae` (needs a DNS record from Sirocco IT).

### 3. Resend (order emails)
1. Sign up at <https://resend.com> with the Sirocco email.
2. Add and verify the `sirocco.ae` domain (Sirocco IT adds the DNS records), or a subdomain such as `posm.sirocco.ae`.
3. Create an API key → `RESEND_API_KEY` in Vercel. Set `EMAIL_FROM`, e.g. `POSM SHOP <posm@sirocco.ae>`.
4. Use the same Resend account as Supabase's SMTP server (host `smtp.resend.com`, port 465, user `resend`, password = API key).

### 4. First run
1. Sign in as an admin → **Markets**: set each market's Customer Service email(s) and delivery days.
2. **Excel upload**: upload the 2026 POSM Budgeting workbook. Check the "Sheets read" panel to confirm the right columns were picked up.
3. **Excel upload → Bulk item images**: upload product photos named by SKU.
4. **Items**: set order multiples, max per order and market visibility.
5. **Users**: add KAMs with their market, or let them sign in and assign a market afterwards.

## Excel format

Every sheet is scanned. A sheet is read as **items** if its header row has an SKU column and an item name column. It's read as **accounts** if it has an account/customer number and an account/customer name. Recognised headers (case-insensitive):

- **Items:** `SKU code`/`Item code`/`Material`, `Item name`/`POSM item`/`Description`, `Brand`, `Category`/`Type`, `Value`/`Unit cost`/`Price`, `Current stock`/`Stock level`/`SOH`. Optional: `Max per order`, `Order multiple`/`Pack size`, `Markets` (e.g. `UAE, Oman` or `All`)
- **Accounts:** `Account number`/`Customer no`/`Sold to`, `Account name`/`Customer name`/`Outlet`, `Market`/`Country`, `Channel`

Download the template from Admin → Excel upload to see the layout. If the real workbook uses different headings, add them to the alias lists in `src/lib/excel.ts`.

## Development

```bash
cp .env.example .env.local   # fill in values from a Supabase project
npm install
npm run dev
```

`npm run typecheck` and `npm run build` must pass before deploying.

### Code map
- `supabase/migrations/` — schema, row-level security, `place_order` (limits, multiples, stock, order numbers)
- `src/app/(shop)/` — KAM flow: `/` account and contact → `/shop` items → `/cart` → `/cart/confirm` → `/orders/[id]`
- `src/app/(shop)/admin/` — dashboard, orders, reports, items, Excel upload, accounts, users, markets
- `src/lib/excel.ts` — workbook parsing and template · `src/lib/email.ts` — the three order emails · `src/lib/reports.ts` — report queries and exports
- `src/components/Logo.tsx` — logo traced from the brand book. **Swap in the official SVG when Sirocco supplies it.**
