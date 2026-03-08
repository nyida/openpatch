# Deploy to Vercel – Checklist

## 1. Set environment variables

In **Vercel** → your project → **Settings** → **Environment Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://user:password@host:6543/postgres` (pooler URL, no quotes) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `ENCRYPTION_KEY` | 32+ character secret | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key (or `OPENAI_API_KEY`) | Yes |

**DATABASE_URL rules:**
- Must start with `postgresql://` or `postgres://`
- No spaces, no quotes around the value
- Use **pooler** URL (port 6543 for Supabase, pooler host for Neon)

## 2. Create database tables (once)

```bash
npx prisma db push
```

Use the same `DATABASE_URL` you set in Vercel.

## 3. Deploy

Push to `main` – Vercel deploys automatically.

## Troubleshooting

**"DATABASE_URL is missing or invalid"**  
→ Add or fix `DATABASE_URL` in Vercel Settings → Environment Variables, then redeploy.

**"the URL must start with the protocol"**  
→ Remove quotes/spaces from the value. Paste only the raw URL.
