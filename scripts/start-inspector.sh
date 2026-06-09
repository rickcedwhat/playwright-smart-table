#!/bin/bash

# Port for the UI
UI_PORT=6274
# Port for the MCP Server
MCP_PORT=3001

echo "🚀 Starting Smart Table Inspector..."

# 1. Check if UI is already running
UI_PID=$(lsof -Pi :$UI_PORT -sTCP:LISTEN -t)
if [ ! -z "$UI_PID" ]; then
    echo "✅ UI is already running on port $UI_PORT"
else
    echo "📦 Starting Inspector UI..."
    # Start UI and redirect logs to a temp file for debugging if it fails
    pnpm --filter inspector run dev > inspector-ui.log 2>&1 &
    
    # Wait for UI to be ready with a timeout
    COUNT=0
    TIMEOUT=30
    while ! lsof -Pi :$UI_PORT -sTCP:LISTEN -t >/dev/null ; do 
        if [ $COUNT -ge $TIMEOUT ]; then
            echo "❌ UI failed to start within ${TIMEOUT}s. Check inspector-ui.log"
            exit 1
        fi
        sleep 1
        ((COUNT++))
        echo -n "."
    done
    echo ""
    echo "✅ UI started at http://localhost:$UI_PORT"
fi


# 2. Restart MCP Server
echo "🔄 Restarting MCP Server..."
# Kill existing MCP server if running on port
MCP_PID=$(lsof -Pi :$MCP_PORT -sTCP:LISTEN -t)
if [ ! -z "$MCP_PID" ]; then
    kill -9 $MCP_PID
fi

# Start MCP Server
pnpm --filter @rickcedwhat/playwright-smart-table-mcp run inspector:serve > inspector-server.log 2>&1 &

# Wait for Server to be ready
echo "📡 Waiting for SSE server..."
COUNT=0
while ! curl -s http://localhost:$MCP_PORT/health >/dev/null ; do 
    if [ $COUNT -ge 10 ]; then
        echo "❌ Server failed to start. Check inspector-server.log"
        exit 1
    fi
    sleep 1
    ((COUNT++))
    echo -n "."
done
echo ""

echo "✨ Inspector is ready!"

echo "🔗 UI: http://localhost:$UI_PORT"
echo "📡 SSE: http://localhost:$MCP_PORT/sse"

# Keep script alive to catch Ctrl+C if desired, or just exit
# For this request, we'll wait for the MCP server process
wait
