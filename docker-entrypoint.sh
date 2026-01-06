#!/bin/sh
set -e

echo "🔍 Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi

# Show DATABASE_URL without password for debugging
DB_URL_MASKED=$(echo $DATABASE_URL | sed 's/:[^@]*@/:***@/')
echo "✅ DATABASE_URL is set: ${DB_URL_MASKED}"

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "Database host: ${DB_HOST}, port: ${DB_PORT}"

# Wait for database connection
max_attempts=30
attempt=0
until nc -z ${DB_HOST} ${DB_PORT} 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Database did not become ready in time"
        exit 1
    fi
    echo "Database is unavailable - sleeping (attempt ${attempt}/${max_attempts})"
    sleep 2
done

echo "✅ Database is ready!"
echo "🔄 Running Prisma migrations..."

npx prisma migrate deploy

echo "✅ Migrations completed successfully"
echo "🚀 Starting application..."
exec node dist/index.js

