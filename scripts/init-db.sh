#!/bin/bash

# Database initialization script
# This runs automatically when PostgreSQL container starts for the first time

set -e

echo "Initializing Futsal-GG database..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create extensions if needed
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Set timezone
    SET timezone = 'UTC';

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;

    SELECT 'Database initialized successfully!' AS status;
EOSQL

echo "Database initialization complete!"
