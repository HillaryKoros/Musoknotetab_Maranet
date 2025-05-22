#!/bin/bash
set -e

# Copy mapfiles to the correct location
if [ -d "/mapfiles" ]; then
    cp -f /mapfiles/*.map /var/www/html/mapfiles/ 2>/dev/null || true
    chmod 644 /var/www/html/mapfiles/*.map 2>/dev/null || true
fi

# Create a symlink to the data directory if it doesn't exist
if [ ! -L "/var/www/html/data" ] && [ -d "/etc/mapserver/data" ]; then
    ln -sf /etc/mapserver/data /var/www/html/data
fi

# Set proper permissions for data directories
find /etc/mapserver/data -type d -exec chmod 777 {} \; 2>/dev/null || true
find /etc/mapserver/data -type f -exec chmod 666 {} \; 2>/dev/null || true

# Specifically ensure the subdirectories have correct permissions
for dir in vector raster timeseries; do
  if [ -d "/etc/mapserver/data/$dir" ]; then
    chmod 777 /etc/mapserver/data/$dir
    find /etc/mapserver/data/$dir -type d -exec chmod 777 {} \; 2>/dev/null || true
    find /etc/mapserver/data/$dir -type f -exec chmod 666 {} \; 2>/dev/null || true
  fi
done

# Make sure Apache can read all necessary files
chown -R www-data:www-data /var/www/html
chown -R www-data:www-data /var/log/apache2
chown -R www-data:www-data /var/run/apache2

# Start Apache in foreground
exec apache2ctl -DFOREGROUND