---
version: 1
slug: "src-app-admin-marketing"
primary_target: "src/app/admin/marketing"
related_targets: ["src/components/admin/marketing"]
---

# Admin marketing CRM

## Scope and mode
Operate. Extends `/admin` (same shell, tokens, components). New routes under `/admin/marketing`.

## Audience and job
Adrian, from the admin panel, loads company emails by country, sends outreach from adrianbengolea@notificas.com via Resend, and tracks send / open / click / reply without mixing certified campaigns.

## Action
Scan a country pipeline, import CSV, compose a campaign, send, sync Gmail replies.

## Constraints
- Not fehaciente: opens/clicks are technical signals.
- Gmail is inbox-only (OAuth readonly); Resend is the send pipe.
- Countries: LATAM hispana + BR + ES.
- Visual world: inherit admin. No DESIGN.md change.

## Memorable moment
Country × stage table as the first viewport.

## Unresolved
Google OAuth client credentials not in env yet. Resend must accept From adrianbengolea@notificas.com. Deploy firestore indexes for marketing_sends / marketing_contacts.
