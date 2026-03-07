# SearXNG (self-hosted search)

SearXNG runs locally and provides a free web search API for the OpenPatch pipeline.

## Start the service

```bash
# From project root
cd searxng

# (Optional) Generate secret key for production
# macOS:
sed -i '' "s|change-me-in-production-use-openssl-rand-hex-32|$(openssl rand -hex 32)|g" searxng/settings.yml
# Linux:
# sed -i "s|change-me-in-production-use-openssl-rand-hex-32|$(openssl rand -hex 32)|g" searxng/settings.yml

# Start containers
docker compose up -d

# Check logs
docker compose logs -f searxng
```

Or from project root: `docker compose -f searxng/docker-compose.yml up -d`

SearXNG will be available at **http://localhost:8080**.

## Test the API

```bash
# 1. Direct SearXNG request
curl "http://localhost:8080/search?q=OpenPatch+verification+research&format=json"

# 2. Standalone script (no Next.js needed)
node scripts/test-searxng.mjs

# 3. Via app test route (requires Next.js server running)
curl http://localhost:3000/api/search/test
```

## App integration

Set in `.env`:

```
SEARXNG_BASE_URL=http://localhost:8080   # optional; defaults to this
SEARXNG_ENABLED=true                      # use SearXNG for web search (when TAVILY_ENABLED is false)
```

When `SEARXNG_ENABLED=true` and `TAVILY_ENABLED` is not set, the pipeline uses `searchWeb()` instead of Tavily. Run the migration: `npx prisma migrate deploy`

Use `searchWeb(query)` from `@/lib/searxng` in server-side code. The function returns:

```ts
{
  query: string,
  results: [{ title, url, content, engine? }]
}
```

## Stop

```bash
docker compose down
```
