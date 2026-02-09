# OAuth Redirect URL Tester

Test OAuth 2.0 and OpenID Connect flows interactively. Configure any provider, walk through the authorization flow step by step, and inspect tokens.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkgidwani%2Foauth-test-web)

## Features

- Step-by-step OAuth flow wizard (Configure, Build URL, Redirect, Callback, Token Exchange, Results)
- Provider presets: Auth0, Okta, Google, GitHub, Microsoft Entra ID, or custom
- Flow types: Authorization Code, Authorization Code + PKCE, Implicit
- JWT decoding with header/payload inspection
- PKCE code challenge/verifier generation via Web Crypto API
- Dark mode support

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The app runs at `http://localhost:3000`. In development mode, token exchange is proxied through the server to avoid CORS issues and keep the client secret server-side.

## Static Deployment (GitHub Pages)

Generate a static site:

```bash
npm run generate
```

Deploy is automated via GitHub Actions on push to `main`. To enable:

1. Go to repo **Settings > Pages > Source** and select **GitHub Actions**
2. Push to `main` — the workflow builds and deploys automatically

### Static Deployment Notes

When deployed to GitHub Pages (or any static host), there is no server — token exchange happens directly from the browser. This has tradeoffs:

| Flow | Static Hosting | Notes |
|---|---|---|
| **Authorization Code + PKCE** | Safe | No client secret needed. PKCE was designed for public clients (SPAs). **Recommended for static deployments.** |
| **Authorization Code** (with secret) | Secret exposed | The `client_secret` is visible in browser DevTools (Network tab, JS source). Only use for testing with disposable credentials. |
| **Implicit** | Safe | No exchange step — tokens arrive directly in the URL fragment. |

**CORS limitations:** Some providers (e.g. GitHub) do not set CORS headers on their token endpoints, so client-side token exchange will fail. For those providers, run the app locally with `npm run dev` to use the server-side proxy.

**Recommendation:** Use **Authorization Code + PKCE** when accessing via GitHub Pages. It is secure by design with no secret required. For flows that need a client secret or providers that block CORS, run locally.

## Production Build

```bash
npm run build
npm run preview
```

In production server mode, all token exchanges are proxied server-side — no credentials are exposed to the browser.

## Security

> **This is a testing/educational tool.** Use development or test credentials only — never enter production secrets.

### Server-side protections (active in `npm run build` / `npm run dev`)

The `/api/oauth/token` proxy endpoint includes the following hardening:

| Protection | Details |
|---|---|
| **SSRF prevention** | Outbound requests are blocked to private networks (RFC 1918), link-local/cloud metadata (`169.254.x`), IPv6 loopback/ULA, and `0.0.0.0`. Hostnames are DNS-resolved and all returned IPs are checked before the request is made. |
| **Rate limiting** | 30 requests per minute per IP (in-memory sliding window). Returns `429` with `Retry-After` header when exceeded. |
| **Input validation** | Max length enforcement on all parameters (URL: 2048, code: 4096, secret: 512, verifier: 128 chars). |
| **Request timeout** | 10-second abort timeout on outbound fetch to token endpoints. |
| **Response size limit** | 1 MB max response body from token endpoints. |
| **Redirect URI validation** | Must use HTTPS (localhost exempt for development). |
| **Error sanitization** | HTML tags stripped from provider error messages, truncated to 500 chars. |
| **Port allowlist** | Only standard ports allowed on token endpoints (80, 443, 3000, 8080, 8443). |

### Security headers

All responses include:

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables unused browser APIs
- `X-DNS-Prefetch-Control: off` — prevents DNS prefetch information leaks

### Client-side storage

All session state (config, tokens, PKCE verifier) is stored in `localStorage` **unencrypted**. This is acceptable for a testing tool but means:

- Anyone with access to the browser/device can read stored values
- Data persists until the user clicks **Reset** or clears browser storage
- Tokens and secrets are vulnerable to XSS (mitigated by Vue's auto-escaping)

### Known limitations

- **JWT signatures are not verified** — tokens are decoded for inspection only, with no public key / JWKS lookup
- **Nonce is generated but not validated** on the response (acceptable for a testing tool)
- **No HSTS header** by default — enable at the reverse proxy / CDN level for your domain

## Deployment Architecture

### Recommended: Serverless / Edge (Vercel, Cloudflare Pages, Netlify)

```
User  →  CDN/Edge  →  Serverless Function (/api/oauth/token)
                   →  Static Assets (/, /callback)
```

- SSRF risk is reduced — serverless functions are network-isolated from internal infrastructure
- Edge rate limiting available as an additional layer (Vercel WAF, Cloudflare rules)
- HTTPS and HSTS handled automatically by the platform
- Zero server maintenance

**Vercel:**
```bash
npx vercel
```

**Cloudflare Pages:**
```bash
npx wrangler pages deploy .output/public
```

### Alternative: Container (Docker / Kubernetes)

```
User  →  Reverse Proxy (nginx/Caddy)  →  Node.js (.output/server/index.mjs)
```

If containerized, place behind a reverse proxy with:

- TLS termination + HSTS header
- IP-based rate limiting (supplements the built-in limiter)
- Optionally restrict outbound network to known OAuth provider domains only

```bash
npm run build
node .output/server/index.mjs
```

### Static-only (GitHub Pages)

```
User  →  CDN  →  Static HTML/JS (no server)
```

- No server-side proxy — token exchange falls back to client-side fetch
- SSRF protection, rate limiting, and error sanitization do **not** apply
- Best paired with **PKCE flow** which needs no client secret

## CI/CD

Two GitHub Actions workflows are included:

### CI (`.github/workflows/ci.yml`)

Runs on every push to any branch.

| Step | Command |
|---|---|
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |

Uses Node 22 on `ubuntu-latest`.

### Deploy (`.github/workflows/deploy.yml`)

Runs on push to `main` (and manual `workflow_dispatch`). Builds a static site with `npm run generate` and deploys to GitHub Pages.

| Step | Action |
|---|---|
| Checkout | `actions/checkout@v6` |
| Node setup | `actions/setup-node@v6` |
| Build | `npm run generate` (with `NUXT_APP_BASE_URL` set to repo name) |
| Upload | `actions/upload-pages-artifact@v4` |
| Deploy | `actions/deploy-pages@v4` |

**Setup:** Go to repo **Settings > Pages > Source** and select **GitHub Actions**. The deploy workflow uses `id-token: write` permission and the `github-pages` environment with concurrency protection (in-progress deploys are cancelled by newer pushes).
