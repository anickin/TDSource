# Debian portfolio hosting

This deployment runs TDSource as a portfolio/archive application on a Debian
server. It preserves Webex sign-in, the Q&A and SOP library, document viewing,
search, and Knowledge Chat/RAG. It does not capture Webex conversations and it
does not connect to the replacement Microsoft automation pipeline.

## Runtime shape

- Docker builds the React client and runs the Worker API locally with Wrangler.
- The application listens on port `8787` inside the `public-web` Docker network.
- The existing Nginx upstream can continue to target `webapp-prod:8787`.
- Nginx terminates HTTPS for `tdsource.nickolasinit.com`.
- Supabase remains the durable data store.
- A loopback-invoked, bearer-protected scheduler runs RAG indexing every five
  minutes. Nginx blocks the internal route from the public site.

## 1. Prepare Debian

Install Docker Engine with the Compose plugin, clone this repository, and check
out the deployment branch:

```bash
git fetch origin
 git switch feature/debian-portfolio-hosting
fatal: invalid reference: feature/debian-portfolio-hosting
docker network inspect public-web >/dev/null 2>&1 || docker network create public-web
```

## 2. Configure secrets

Create the server-local environment file from the template:

```bash
cp docker.env.example docker.env
chmod 600 docker.env
```

Generate two different secrets and place them in `docker.env`:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Set the existing Supabase and Gemini credentials. Do not add Webex bot tokens or
a webhook secret. `docker.env` is ignored by Git and must stay on the Debian
server.

If RAG uses Ollama instead of Gemini, set `LLM_PROVIDER=ollama`, `LLM_MODEL`, and
`LLM_BASE_URL`. Use a host/LAN address reachable from the container; container
`127.0.0.1` refers to the container itself.

## 3. Configure Webex OAuth

In the Webex integration settings, register this exact redirect URI:

```text
https://tdsource.nickolasinit.com/api/auth/webex/callback
```

Use the integration's client ID and client secret in `docker.env`. Portfolio
mode requests identity/profile access only. No Webex bot, room membership, or
public webhook endpoint is required.

The DNS record for `tdsource.nickolasinit.com` must resolve to the public entry
point for the Debian reverse proxy. Webex redirects the user's browser, so the
HTTPS site must be reachable by the people signing in even though TDS does not
receive Webex webhook deliveries.

## 4. Configure Nginx

Keep the application container private to the Docker network and proxy HTTPS to
the existing container name:

```nginx
location ^~ /api/internal/ {
    return 404;
}

location / {
    proxy_pass http://webapp-prod:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The `__Host-tds_session` cookie is secure-only. Login will not work through a
plain HTTP origin or if `APP_ORIGIN`, the Webex redirect URI, and the browser URL
do not match.

## 5. Build and run

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 tdsource
```

From another container on `public-web`, or through the HTTPS proxy, verify:

```bash
curl -fsS https://tdsource.nickolasinit.com/api/health
curl -fsS https://tdsource.nickolasinit.com/api/config
```

The config response must report `"portfolioMode":true` and
`"webexCaptureEnabled":false`. Then test Webex login, Q&A search/document
opening, and at least one Knowledge Chat question with citations.

## Updating and rollback

Rebuild after pulling a reviewed change:

```bash
git pull --ff-only
docker compose build
docker compose up -d
```

For application rollback, switch to the last known-good commit and rebuild.
The portfolio flag is additive and does not change Supabase data. Do not switch
to `product` mode on the public server unless bot capture credentials, signed
webhook handling, room policies, and the full former production workflow have
been intentionally restored and revalidated.
