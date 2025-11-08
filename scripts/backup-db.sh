#!/bin/bash

# Database Backup Script
# Run this periodically or set up as a cron job

set -e

BACKUP_DIR="/opt/futsal-gg/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/futsal_gg_backup_$TIMESTAMP.sql"

echo "Creating database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup
docker compose exec -T postgres pg_dump -U futsalgg futsalgg > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Old backups cleaned up (kept last 30 days)"
echo "Backup completed successfully!"
