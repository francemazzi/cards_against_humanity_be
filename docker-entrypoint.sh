#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed successfully"
echo "🚀 Starting application..."
exec node dist/index.js

