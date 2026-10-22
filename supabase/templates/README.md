# Supabase auth email templates

Paste each file into **Supabase → Authentication → Emails → Templates** (switch the editor to
"Source"/HTML), with the subject below. They use Supabase's template variables
(`{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Data.full_name }}`).

| Template        | File                  | Subject                                  |
|-----------------|-----------------------|------------------------------------------|
| Magic Link      | `magic-link.html`     | `Your POSM SHOP sign-in code: {{ .Token }}` |
| Confirm signup  | `confirm-signup.html` | `Your POSM SHOP sign-in code: {{ .Token }}` |
| Invite user     | `invite.html`         | `You're invited to POSM SHOP`            |

- **Magic Link** is sent when an existing user signs in; **Confirm signup** when someone signs in
  for the very first time. Both show the code and a one-click sign-in button.
- **Invite user** is sent from Admin → Users → Add user (with "Email an invite" ticked).
- Links go to `/auth/confirm` on the **Site URL** (Authentication → URL Configuration), so that must
  be the live POSM SHOP address. The logo is loaded from `<Site URL>/email-logo-white.png`.
