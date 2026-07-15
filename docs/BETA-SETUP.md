# BETA FRONTEND — setup runbook

Goal: preview un-merged frontend changes on a live-like URL, without redeploying the live
frontend. **One new service: a beta frontend.** It talks to the **existing live backend**.

```
  LIVE                                  BETA (frontend only)
  epic-quote-v3-web-saad                epic-quote-v3-web-beta
        │ deploys from main                   │ deploys from staging
        └─────────────┬──────────────────────┘
                      ▼   VITE_API_URL → same live API
              epic-quote-v3-api-saad  →  LIVE DB + LIVE Shopify   (shared)
```

## What this is (and isn't)

- **Is:** a second build of the frontend, from a `staging` branch, so you can see UI changes
  live before merging them to the real site.
- **Isn't** isolated. Beta uses the **live backend → live DB → live Shopify.** A real click in
  beta writes real data and can fire a real payment link. So:
  - Use beta to eyeball UI / layout / copy changes.
  - Don't treat it as a safe sandbox — avoid create-payment-link / delete in beta unless you mean it.
  - **Backend changes can't be tested here** (the live backend doesn't have your un-merged backend
    code until you deploy it). Frontend-only.

## Step 1 — `staging` branch

Beta frontend deploys from `staging`; live stays on `main`.

```
git checkout -b staging
git push origin staging        # + `git push second staging` if Render watches the `second` remote
```

Per task: work on `staging` → beta frontend auto-builds → preview → merge `staging → main` →
live frontend updates.

## Step 2 — beta frontend service (Render dashboard)

New → Static Site → same repo → **Branch: `staging`**, root `frontend`,
build `npm ci && npm run build`, publish `dist`. Name it `epic-quote-v3-web-beta`.
Reuse the SPA rewrite + security headers from the live static site (see `render.yaml`).

Env: `VITE_API_URL` = the **existing live** API url (e.g. `https://epic-quote-v3-api-saad.onrender.com`).

> CORS: no change. `config/cors.php` already allows any `https://epic-quote-v3-*.onrender.com`
> origin. A custom domain instead → add it to the `CORS_ALLOWED_ORIGINS` env var on the live API.

## Step 3 — verify

Open the beta url, log in, confirm the network tab hits the live API. That's it — you're
previewing your `staging` changes against live data.

## Promotion (beta → live)

```
git checkout main
git merge --ff-only staging
git push origin main            # + `git push second main` — live frontend deploys
```

Keep `staging` current with `main` after each promotion.
