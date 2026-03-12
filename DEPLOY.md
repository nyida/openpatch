# Deploy to Vercel + Supabase

## Pre-deploy checklist

- [ ] `public/logo.png` and `public/paper.pdf` exist (or update links in code)
- [ ] Supabase project created at [supabase.com](https://supabase.com)
- [ ] OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys)

**Note:** The run API can take up to 5 minutes for multi-candidate mode. Vercel Hobby plan limits functions to 10s; use Pro for full pipeline.

---

## 1. Connect & deploy

Push your repo to GitHub. In Vercel, import the project and deploy.

---

## 2. Add Supabase integration

Vercel → your project → **Integrations** → search **Supabase** → Add.

- Connect to your Supabase project
- **Custom Prefix:** leave empty
- **Environments:** Production (and Preview if you want)
- Install

This adds `DATABASE_URL`, `POSTGRES_PRISMA_URL`, and Supabase auth vars automatically.

---

## 3. Add env vars manually

Vercel → **Settings** → **Environment Variables**:

| Name | Value | Required |
|------|-------|----------|
| `OPENROUTER_API_KEY` | Your key from [openrouter.ai/keys](https://openrouter.ai/keys) | Yes |
| `ENCRYPTION_KEY` | Any 32+ character secret (e.g. `openpatch-secret-key-32-chars-min`) | Yes |
| `TAVILY_API_KEY` | [Tavily](https://tavily.com) key for web search + images | No |
| `VERSION_TAG` | e.g. `v1.0.0` | No |

---

## 4. Create database tables

**Option A – Using Vercel CLI (easiest):**
```bash
vercel link    # link to your Vercel project
npm run db:push:prod
```
Pulls prod env vars and pushes schema.

**Option B – Manual:** Get your pooler URL from Supabase (Connect → Transaction pooler), then:
```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" npx prisma db push
```

---

## 5. Supabase redirect URL

Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**:
Add `https://your-app.vercel.app/**` (replace with your actual Vercel domain).

---

## 6. Redeploy

Deployments → ⋮ → **Redeploy** (uncheck Use existing Build Cache).

---

## Done

Visit your app. Use **/setup** to verify config. Sign in and ask a question.
