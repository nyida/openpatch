#!/usr/bin/env bash
# Start 5 Ollama instances on ports 11434–11438 for parallel 5-candidate runs.
# Usage: ./scripts/start-5-ollama.sh
# Then in .env set: OLLAMA_URLS="http://localhost:11434/v1,http://localhost:11435/v1,http://localhost:11436/v1,http://localhost:11437/v1,http://localhost:11438/v1"

set -e
PORTS=(11434 11435 11436 11437 11438)
for p in "${PORTS[@]}"; do
  if [ "$p" = "11434" ]; then
    echo "Start main Ollama on :11434 (default)..."
    ollama serve &
  else
    echo "Start Ollama on :$p..."
    OLLAMA_HOST="127.0.0.1:$p" ollama serve &
  fi
  sleep 1
done
echo "Done. Set OLLAMA_URLS in .env to use all 5. Pull models: ollama pull llama3.2 && ollama pull qwen2.5:3b && ..."
