#!/usr/bin/env bash
set -e

# ========================================
#   AI Training - Dev Environment Startup (Linux)
# ========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/code/backend"
FRONTEND_DIR="$PROJECT_DIR/code/frontend"

echo "========================================"
echo "  AI Training - Dev Environment Startup"
echo "========================================"
echo ""

# [1/6] Clean residual processes
echo "[1/6] Cleaning residual node processes..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
# Proxy pool cleanup (if running)
pkill -f "proxyPool.py" 2>/dev/null || true
echo -e "${GREEN}[OK]${NC} Processes cleaned"
echo ""

# [2/6] Start IP proxy pool (optional)
echo "[2/6] Starting IP proxy pool (Redis + proxy_pool)..."
PROXY_POOL_DIR="${PROXY_POOL_DIR:-$HOME/proxy_pool}"
PYTHON_CMD=""

# Detect Python
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PYTHON_CMD="$cmd"
        break
    fi
done

# Start Redis (system service or manual)
if command -v redis-server &>/dev/null; then
    if redis-cli ping &>/dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Redis already running"
    else
        if systemctl is-active --quiet redis 2>/dev/null; then
            echo -e "${GREEN}[OK]${NC} Redis (systemd) is running"
        else
            redis-server --daemonize yes 2>/dev/null || true
            sleep 1
            if redis-cli ping &>/dev/null 2>&1; then
                echo -e "${GREEN}[OK]${NC} Redis started - port 6379"
            else
                echo -e "${YELLOW}[WARN]${NC} Redis may not have started correctly"
            fi
        fi
    fi
elif systemctl is-active --quiet redis 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Redis (systemd) is running"
else
    echo -e "${YELLOW}[WARN]${NC} Redis not found, proxy pool unavailable"
fi

# Start proxy_pool (if available)
if [ -n "$PYTHON_CMD" ] && [ -d "$PROXY_POOL_DIR" ]; then
    cd "$PROXY_POOL_DIR"
    nohup "$PYTHON_CMD" proxyPool.py schedule > /tmp/proxypool-schedule.log 2>&1 &
    sleep 1
    nohup "$PYTHON_CMD" proxyPool.py server > /tmp/proxypool-server.log 2>&1 &
    sleep 2
    echo -e "${GREEN}[OK]${NC} Proxy pool started - port 5010"
elif [ -n "$PYTHON_CMD" ]; then
    echo -e "${YELLOW}[WARN]${NC} Proxy pool project not found at $PROXY_POOL_DIR"
else
    echo -e "${YELLOW}[WARN]${NC} Python not found, proxy pool unavailable"
fi
echo ""

# [3/6] Clean backend build cache
echo "[3/6] Cleaning backend build cache..."
cd "$BACKEND_DIR"
rm -rf dist 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .tsx 2>/dev/null || true
rm -f *.tsbuildinfo 2>/dev/null || true
echo -e "${GREEN}[OK]${NC} Cache cleaned"
echo ""

# [4/6] Build backend
echo "[4/6] Building backend code..."
cd "$BACKEND_DIR"
if npm run build; then
    echo -e "${GREEN}[OK]${NC} Backend build successful"
else
    echo -e "${RED}[ERROR]${NC} Backend build failed!"
    exit 1
fi
echo ""

# [5/6] Start backend (dev mode)
echo "[5/6] Starting backend service (dev mode - tsx watch)..."
cd "$BACKEND_DIR"
nohup npm run dev > /tmp/backend.log 2>&1 &
echo -e "${GREEN}[OK]${NC} Backend service started (PID: $!)"
echo ""

sleep 3

# [5.5/6] Clean frontend Vite cache
echo "[5.5/6] Clearing frontend Vite cache..."
cd "$FRONTEND_DIR"
rm -rf node_modules/.vite 2>/dev/null || true
echo -e "${GREEN}[OK]${NC} Frontend cache cleaned"

# [6/6] Start frontend
echo "[6/6] Starting frontend service..."
cd "$FRONTEND_DIR"
nohup npm run dev -- --force > /tmp/frontend.log 2>&1 &
echo -e "${GREEN}[OK]${NC} Frontend service started (PID: $!)"
echo ""

echo "========================================"
echo "  [SUCCESS] All services started!"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  Proxy Pool: http://127.0.0.1:5010"
echo "  Backend API: http://localhost:3004"
echo "  Frontend UI: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop all: ./kill-node.sh"
echo ""

# Open browser
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:3000" 2>/dev/null || true
    echo "Browser opened to http://localhost:3000"
fi
