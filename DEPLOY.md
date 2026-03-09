# Deploy to Vercel (5 steps)

## 1. Connect & deploy

Push your repo to GitHub. In Vercel, import the project and deploy.

---

## 2. Add Supabase integration

Vercel → your project → **Integrations** → search **Supabase** → Add.

- Connect to **openpatch**
- **Custom Prefix:** leave empty
- **Environments:** Production (and Preview if you want)
- Install

This adds database + auth env vars automatically.

---

## 3. Add 2 env vars manually

Vercel → **Settings** → **Environment Variables**:

| Name | Value |
|------|-------|
| `OPENROUTER_API_KEY` | Your key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `ENCRYPTION_KEY` | Any 32+ character secret (e.g. `openpatch-secret-key-32-chars-min`) |

---

## 4. Create database tables

**Option A – Using Vercel CLI (easiest):**
```bash
npm run db:push:prod
```
Requires `vercel link` in the project. Pulls prod env vars and pushes schema.

**Option B – Manual:** Get your pooler URL from Supabase (Connect → Transaction pooler), then:
```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" npx prisma db push
```

---

## 5. Supabase redirect URL

Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**:
Add `https://your-app.vercel.app/**` (your actual Vercel domain).

---

## 6. Redeploy

Deployments → ⋮ → **Redeploy** (uncheck Use existing Build Cache).

---

## Done

Visit your app. Use **/setup** to verify config. Sign in and ask a question.
