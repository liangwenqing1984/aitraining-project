#!/usr/bin/env bash
# Kill all dev server processes

echo "Stopping all dev services..."

# Backend (tsx watch)
pkill -f "tsx watch" 2>/dev/null && echo "  Backend (tsx): stopped" || echo "  Backend (tsx): not running"

# Frontend (vite)
pkill -f "vite" 2>/dev/null && echo "  Frontend (vite): stopped" || echo "  Frontend (vite): not running"

# Proxy pool
pkill -f "proxyPool.py" 2>/dev/null && echo "  Proxy pool: stopped" || echo "  Proxy pool: not running"

# Redis (only if started by us - daemon mode)
if [ -f /tmp/redis_dev.pid ]; then
    kill "$(cat /tmp/redis_dev.pid)" 2>/dev/null && echo "  Redis: stopped" || true
    rm -f /tmp/redis_dev.pid
fi

echo "Done."
