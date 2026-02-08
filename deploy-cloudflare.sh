#!/bin/bash

set -e

echo "=========================================="
echo "Cards Against Humanity - Cloudflare Deploy"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed${NC}"
    exit 1
fi

# Check cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}Installing cloudflared...${NC}"
    curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i /tmp/cloudflared.deb
fi

# Detect docker compose command
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}Using: ${COMPOSE_CMD}${NC}"

# Step 1: Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
$COMPOSE_CMD -f docker-compose.prod.yml down 2>/dev/null || true

# Kill any existing cloudflared processes
pkill cloudflared 2>/dev/null || true
sleep 2

# Step 2: Create .env for initial build
echo -e "${YELLOW}Creating initial .env...${NC}"
cat > .env << 'ENVEOF'
API_PORT=3300
CLIENT_PORT=6609
VITE_API_URL=http://localhost:3300
DB_PORT=5457
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cah_secure_password_2024
DATABASE_URL=postgresql://postgres:cah_secure_password_2024@db:5432/cards_db
ENVEOF

# Copy OpenAI key if exists
if [ -f .env.backup ] && grep -q "OPENAI_API_KEY" .env.backup; then
    OPENAI_KEY=$(grep "OPENAI_API_KEY" .env.backup | cut -d'=' -f2)
    echo "OPENAI_API_KEY=${OPENAI_KEY}" >> .env
fi

# Step 3: Build and start containers
echo -e "${YELLOW}Building Docker images...${NC}"
$COMPOSE_CMD -f docker-compose.prod.yml build

echo -e "${YELLOW}Starting containers...${NC}"
$COMPOSE_CMD -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 15

# Check if services are running
if ! docker ps | grep -q cards-against-humanity-api; then
    echo -e "${RED}API container failed to start${NC}"
    $COMPOSE_CMD -f docker-compose.prod.yml logs api
    exit 1
fi

echo -e "${GREEN}Containers are running!${NC}"

# Step 4: Start Cloudflare tunnels
echo -e "${YELLOW}Starting Cloudflare tunnels...${NC}"

# Clean up old log files
rm -f /tmp/cf_api.log /tmp/cf_client.log

# Start API tunnel
echo -e "${BLUE}Starting API tunnel on port 3300...${NC}"
nohup cloudflared tunnel --url http://localhost:3300 > /tmp/cf_api.log 2>&1 &
API_PID=$!
sleep 8

# Extract API URL from log
API_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf_api.log | head -1)

if [ -z "$API_URL" ]; then
    echo -e "${RED}Failed to get API tunnel URL. Log contents:${NC}"
    cat /tmp/cf_api.log
    exit 1
fi

echo -e "${GREEN}API URL: ${API_URL}${NC}"

# Start Client tunnel
echo -e "${BLUE}Starting Client tunnel on port 6609...${NC}"
nohup cloudflared tunnel --url http://localhost:6609 > /tmp/cf_client.log 2>&1 &
CLIENT_PID=$!
sleep 8

# Extract Client URL
CLIENT_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf_client.log | head -1)

if [ -z "$CLIENT_URL" ]; then
    echo -e "${RED}Failed to get Client tunnel URL. Log contents:${NC}"
    cat /tmp/cf_client.log
    exit 1
fi

echo -e "${GREEN}Client URL: ${CLIENT_URL}${NC}"

# Step 5: Update .env with actual API URL and rebuild client
echo -e "${YELLOW}Updating configuration with tunnel URLs...${NC}"

# Backup current env
cp .env .env.backup

cat > .env << ENVEOF
API_PORT=3300
CLIENT_PORT=6609
VITE_API_URL=${API_URL}
DB_PORT=5457
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cah_secure_password_2024
DATABASE_URL=postgresql://postgres:cah_secure_password_2024@db:5432/cards_db
ENVEOF

# Restore OpenAI key
if [ -f .env.backup ] && grep -q "OPENAI_API_KEY" .env.backup; then
    OPENAI_KEY=$(grep "OPENAI_API_KEY" .env.backup | cut -d'=' -f2)
    echo "OPENAI_API_KEY=${OPENAI_KEY}" >> .env
fi

# Rebuild only the client with new API URL
echo -e "${YELLOW}Rebuilding client with tunnel URL...${NC}"
$COMPOSE_CMD -f docker-compose.prod.yml build client
$COMPOSE_CMD -f docker-compose.prod.yml up -d client

sleep 5

# Final status
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${GREEN}Game Client:${NC} ${CLIENT_URL}"
echo -e "${GREEN}API Endpoint:${NC} ${API_URL}"
echo ""
echo -e "${YELLOW}Share the Client URL with friends to play!${NC}"
echo ""
echo -e "${BLUE}Tunnel PIDs: API=${API_PID}, Client=${CLIENT_PID}${NC}"
echo -e "${BLUE}To stop tunnels: pkill cloudflared${NC}"
echo ""
echo -e "${YELLOW}View container logs:${NC}"
echo "  ${COMPOSE_CMD} -f docker-compose.prod.yml logs -f"
echo ""

# Save URLs to file for reference
cat > /tmp/cah_urls.txt << EOF
Cards Against Humanity - Public URLs
=====================================
Game Client: ${CLIENT_URL}
API Endpoint: ${API_URL}
Generated: $(date)
EOF

echo -e "${GREEN}URLs saved to /tmp/cah_urls.txt${NC}"
