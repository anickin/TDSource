# The Document Source

Portfolio-ready archive of TD SYNNEX's former Webex-to-knowledge-base application.

The product is bot-triggered automation: a user replies in a Webex thread with
`@<capture-identity> document` or `@<capture-identity> update`; TDS verifies the
signed webhook, retrieves only that thread through an authorized organization
capture identity, creates an immutable snapshot, and ultimately places a draft
in the moderator review queue. The web-based room browser is diagnostic and is
not the intended day-to-day capture workflow. See `AGENTS.md` for non-negotiable
implementation guardrails.

## Local setup

1. Copy `.env.example` to `.env` for browser-safe settings.
2. Copy `.dev.vars.example` to `.dev.vars` for local Worker settings. Real authentication and server integrations are required; the application no longer supplies mock records.
3. Install with `pnpm install`.
4. Run `pnpm dev` for the local Cloudflare preview or `pnpm build` for a production bundle.

The Vite development server and Worker API share one origin. Use `pnpm deploy`
to deploy the Worker and static assets after authenticating Wrangler. Store
production credentials with `wrangler secret put`; do not add them to `.env`.

The historical Cloudflare deployment used
`https://the-document-source.nickolaskg.workers.dev/api/auth/webex/callback`.
The Debian portfolio deployment uses the redirect documented below. OAuth uses Authorization Code with PKCE, validates the
returned state and nonce, restricts sign-in to configured email domains, and
stores only an encrypted short-lived identity session in the browser cookie.

Development and production both load authoritative server data. Empty integrations produce honest loading, empty, or configuration states rather than representative records.

## Debian portfolio deployment

The supported self-hosted profile keeps Webex OAuth sign-in, the searchable Q&A
library, document views, and Knowledge Chat/RAG. It disables message capture,
Webex room discovery, capture-identity storage, and webhook registration.

Use `docker-compose.yml` with `TDS_DEPLOYMENT_MODE=portfolio`. The exact Webex
OAuth redirect URI for this deployment is:

`https://tdsource.nickolasinit.com/api/auth/webex/callback`

See `docs/docker-self-hosting.md` for the Debian, reverse-proxy, secret, Webex,
and validation steps. The existing Cloudflare product configuration remains
available for historical reference and is not used by the portfolio container.

See `docs/architecture.md` for module boundaries and `docs/requirements-decisions.md` for reconciled requirements and unresolved product decisions.

## SOP document import

Admins and Moderators can open **Create SOP** in local or production environments to upload PDF, DOCX, or XLSX documents and generate an editable procedure using the configured AI provider. Generated drafts remain unpublished until they are submitted to the durable review queue and approved. See docs/sop-document-upload.md for provider setup, supported content, and limits.
