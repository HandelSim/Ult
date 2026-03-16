#!/bin/bash
# Forge startup script — runs NATS bridge as background daemon,
# then keeps container alive and restarts bridge if it dies.
set -e

WORKSPACE=/workspace
BRIDGE_LOG=$WORKSPACE/nats-bridge.log

echo "[start.sh] Forge starting up..."

# Ensure nats package is installed
cd $WORKSPACE
if [ ! -d node_modules/nats ]; then
  echo "[start.sh] Installing nats package..."
  npm install --production 2>&1 | tail -5
fi

start_bridge() {
  echo "[start.sh] Starting NATS bridge..."
  node $WORKSPACE/nats-bridge.js >> $BRIDGE_LOG 2>&1 &
  BRIDGE_PID=$!
  echo "[start.sh] NATS bridge PID: $BRIDGE_PID"
}

start_bridge

# Watchdog loop — restart bridge if it exits
while true; do
  sleep 30
  if ! kill -0 $BRIDGE_PID 2>/dev/null; then
    echo "[start.sh] Bridge died, restarting..."
    start_bridge
  fi
done
