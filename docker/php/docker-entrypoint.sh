#!/bin/sh
set -e

# Ensure storage directories exist with proper permissions
mkdir -p /var/www/html/storage/logs
touch /var/www/html/storage/logs/error.log

# Set ownership and permissions on storage directory
# This is crucial for SQLite database writes
chown -R www-data:www-data /var/www/html/storage
chmod -R 775 /var/www/html/storage

# Execute the main command (php-fpm runs as www-data via its config)
exec "$@"
