# Production data assets

`whale_data.db` is a **slim** SQLite snapshot (traders, positions, recent trades/activity) shipped so Render/VPS boots with a working desk.

- Full local scraper DB stays outside the repo (`~/Desktop/PolymarketAnalysis/whale_data.db`).
- On Render, prefer a persistent disk at `/var/data` and set `DATA_DIR=/var/data` (auth store) + optionally `WHALE_DB_PATH=/var/data/whale_data.db`.
- Until a disk is mounted, the app uses `./storage/whale_data.db` from the deploy.
