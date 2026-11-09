# Moving the code from GitHub to GitLab

Nothing in the site depends on GitHub: it runs on **Vercel** with **Supabase** and **Resend**, and
those stay exactly as they are. Only *where the code is stored* changes, and Vercel is pointed at
the new place. Allow about 30 minutes.

## What you need

- The backup bundle **`posmshop-full.bundle`** (sent in chat). It holds the whole history,
  and its `main` branch has every change made so far, including the ones GitHub blocked.
- Git on your computer (`git --version` in a terminal; on Windows install it from git-scm.com).
- Admin access to the Vercel project.

## 1. Create the GitLab project

1. Sign up at <https://gitlab.com> with a **Sirocco email** (not the PintFinder one).
2. **New project → Create blank project**. Name: `posmshop`. Visibility: **Private**.
   **Untick** "Initialize repository with a README" (it must start empty).
3. Copy the project's HTTPS address, e.g. `https://gitlab.com/<your-group>/posmshop.git`.

## 2. Upload the code from the bundle

In a terminal, in the folder where you saved the bundle:

```bash
git clone posmshop-full.bundle posmshop
cd posmshop
git checkout main
git remote set-url origin https://gitlab.com/<your-group>/posmshop.git
git push -u origin main
```

GitLab asks you to sign in: use your GitLab username and a **personal access token** with
`write_repository` (GitLab → avatar → Edit profile → Access tokens) as the password.

Check on GitLab that `main` shows the latest commit about off-trade projects and the
"+ Old project" button.

## 3. Point Vercel at GitLab

1. Vercel → the **posmshop** project → **Settings → Git**.
2. **Disconnect** the GitHub repository.
3. **Connect Git Repository → GitLab**, authorise Vercel, choose `posmshop`.
4. Production branch: **main**.

Everything else stays: environment variables, the `posmshop.vercel.app` domain, the scheduled jobs
(from `vercel.json`) and the deployment history. Vercel builds `main` straight away; check
**Deployments** shows it **Ready**.

`vercel.json` already tells Vercel to build `main` only (no preview builds for other branches).

## 4. Run the waiting SQL

In Supabase → SQL editor, run these from the `supabase/migrations` folder, in this order (each is
safe to run again):

| File | What it adds |
|---|---|
| `20261116000000_off_trade_cold_room.sql` | Cold room yes/no on a store |
| `20261117000000_off_trade_influenced_set.sql` | Influenced set by hand on a store |
| `20261118000000_order_sheet.sql` | Order sheet rules and template (Admin → POSM Shop → Order sheet) |
| `20261119000000_off_trade_projects_hub.sql` | Off-trade store projects in Projects, and their stages |

## 5. Check the site

- Off trade dashboard: the stores list headings stay pinned when scrolling; Download Excel works.
- History: **+ Old project** next to the years.
- Projects → New project: searching a store switches to the off-trade form.
- Admin → POSM Shop → **Order sheet**: download a sample.

## Working on the code afterwards

- **Claude Code in the cloud** (the claude.ai sessions used so far) opens repositories from
  GitHub only. With the code on GitLab, use **Claude Code on your computer** instead (the Claude
  desktop app, or `claude` in a terminal) inside the `posmshop` folder from step 2. It can commit
  and `git push` to GitLab the same way.
- Push changes in batches rather than one at a time; each push to `main` is one Vercel build.

## If GitHub reinstates the account

Nothing above is needed: the waiting changes are pushed to GitHub and merged as usual. If you
have already moved, keep GitLab as the home and leave the GitHub repository archived.
