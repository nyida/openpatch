# Deploy to Vercel (zero config)

## One-click setup

1. **Deploy** – Push to GitHub and connect the repo in Vercel.

2. **Add integrations** (Vercel → your project → **Integrations**):
   - **Neon** or **Vercel Postgres** → auto-adds `DATABASE_URL`
   - **Supabase** → auto-adds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Add LLM key** – In **Settings → Environment Variables**, add:
   - `OPENROUTER_API_KEY` (get one at [openrouter.ai/keys](https://openrouter.ai/keys))

4. **Create tables** – Run once: `npx prisma db push` (use the same `DATABASE_URL` as in Vercel).

5. **Supabase redirect** – In Supabase → **Authentication** → **URL Configuration**, add your site URL (e.g. `https://your-app.vercel.app`) to Redirect URLs.

6. **Redeploy** – Vercel will pick up the new env vars.

---

## Setup page

After deploy, visit **/setup** for a live checklist and one-click links to add each integration.

---

## Manual env vars (if not using integrations)

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes – Postgres pooler URL |
| `OPENROUTER_API_KEY` or `OPENAI_API_KEY` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | For auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth |
| `ENCRYPTION_KEY` | For API key storage (32+ chars) |
