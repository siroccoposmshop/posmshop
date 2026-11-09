# Supabase auth email templates

Paste each file into **Supabase → Authentication → Emails → Templates** (switch the editor to
"Source"/HTML), with the subject below. They use Supabase's template variables
(`{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Data.full_name }}`).

| Template        | File                  | Subject                                  |
|-----------------|-----------------------|------------------------------------------|
| Magic Link      | `magic-link.html`     | `Your Commerce Hub sign-in code: {{ .Token }}` |
| Confirm signup  | `confirm-signup.html` | `Your Commerce Hub sign-in code: {{ .Token }}` |
| Invite user     | `invite.html`         | `You're invited to the Commerce Hub`            |

- **Magic Link** is sent when an existing user signs in; **Confirm signup** when someone signs in
  for the very first time. Both show the code and a one-click sign-in button.
- **Invite user** is sent from Admin → Users → Add user (with "Email an invite" ticked).
- Links go to `/auth/continue` on the **Site URL** (Authentication → URL Configuration), so that must
  be the live Commerce Hub address. That page has a "Continue to sign in" button: nothing is used up
  until it's pressed, because work email link scanners (Microsoft Defender Safe Links) open every
  link first, which used to spend the sign-in and make the code fail. Older emails linking to
  `/auth/confirm` land on the same page. The logo is loaded from `<Site URL>/email-logo-white.png`.
