#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRAPER_DIR="${WHALE_SCRAPER_DIR:-$HOME/Desktop/PolymarketAnalysis}"
UID_NUM="$(id -u)"

echo "[algomarket] Ensuring background data pipelines..."

for f in scraper.py scraper_kalshi.py; do
  if [[ ! -f "$SCRAPER_DIR/$f" ]]; then
    echo "[algomarket] WARN: missing $SCRAPER_DIR/$f"
  fi
done

if ! pgrep -f scraper_kalshi.py >/dev/null 2>&1; then
  if launchctl print "gui/${UID_NUM}/com.algomarket.kalshi-live" &>/dev/null; then
    echo "[algomarket] Restarting Kalshi launchd job..."
    launchctl kickstart -k "gui/${UID_NUM}/com.algomarket.kalshi-live" 2>/dev/null || true
  elif launchctl print "gui/${UID_NUM}/com.arbwhale.kalshi-live" &>/dev/null; then
    echo "[algomarket] Restarting legacy Kalshi launchd job..."
    launchctl kickstart -k "gui/${UID_NUM}/com.arbwhale.kalshi-live" 2>/dev/null || true
  else
    echo "[algomarket] Starting Kalshi scraper in background..."
    mkdir -p "$SCRAPER_DIR/logs"
    nohup bash "$ROOT/scripts/run-live-scrapers.sh" >>"$SCRAPER_DIR/logs/kalshi-live.log" 2>&1 &
    disown 2>/dev/null || true
  fi
else
  echo "[algomarket] Kalshi scraper already running"
fi

if launchctl print "gui/${UID_NUM}/com.algomarket.scraper" &>/dev/null || launchctl print "gui/${UID_NUM}/com.arbwhale.scraper" &>/dev/null; then
  echo "[algomarket] Batch scraper launchd active (every 30 min)"
else
  echo "[algomarket] Batch launchd not installed — run: npm run scrape:install:all"
  if ! pgrep -f "python3.*scraper.py" >/dev/null 2>&1; then
    TRADER_COUNT="$(sqlite3 "$SCRAPER_DIR/whale_data.db" "SELECT COUNT(*) FROM traders;" 2>/dev/null || echo 0)"
    SCRAPE_STATUS="$(sqlite3 "$SCRAPER_DIR/whale_data.db" "SELECT value FROM scrape_metadata WHERE key='scrape_status';" 2>/dev/null || echo "")"
    if [[ "$SCRAPE_STATUS" == "in_progress" ]]; then
      echo "[algomarket] Holdings scrape already in progress ($TRADER_COUNT whales) — not starting another"
    elif [[ "$TRADER_COUNT" -lt 50 ]]; then
      echo "[algomarket] Starting holdings scrape in background ($TRADER_COUNT whales in DB)..."
      mkdir -p "$SCRAPER_DIR/logs"
      nohup bash "$ROOT/scripts/run-scraper.sh" >>"$SCRAPER_DIR/logs/batch-scrape.log" 2>&1 &
      disown 2>/dev/null || true
    else
      echo "[algomarket] Holdings data present ($TRADER_COUNT whales) — skipping batch scrape"
    fi
  fi
fi

echo "[algomarket] Background pipelines ready"
