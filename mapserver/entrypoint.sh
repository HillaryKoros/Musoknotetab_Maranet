#!/bin/bash
set -e

# Check if mapserv is available
if [ ! -f "/usr/bin/mapserv" ]; then
    echo "ERROR: MapServer binary not found at /usr/bin/mapserv"
    exit 1
fi

# Create necessary directories
mkdir -p /usr/lib/cgi-bin/ /etc/mapserver /data/geojson
chown -R www-data:www-data /etc/mapserver /data/geojson

# Setup CGI links in both locations for compatibility
mkdir -p /usr/lib/cgi-bin /var/www/html/cgi-bin

# Primary CGI location
if [ ! -f "/usr/lib/cgi-bin/mapserv" ]; then
    ln -sf /usr/bin/mapserv /usr/lib/cgi-bin/mapserv
    chmod 755 /usr/lib/cgi-bin/mapserv
fi

# Secondary CGI location for compatibility
if [ ! -f "/var/www/html/cgi-bin/mapserv" ]; then
    ln -sf /usr/bin/mapserv /var/www/html/cgi-bin/mapserv
    chmod 755 /var/www/html/cgi-bin/mapserv
fi

# Setup health check if not exists
if [ ! -f "/usr/lib/cgi-bin/health" ]; then
    cat > /usr/lib/cgi-bin/health << 'EOF'
#!/bin/bash
echo "Content-Type: text/plain"
echo ""
echo "OK"
EOF
    chmod +x /usr/lib/cgi-bin/health
fi

# Enable Apache modules
a2enmod cgi headers 2>/dev/null || true

# Check Apache configuration
echo "Checking Apache configuration..."
apache2ctl configtest

echo "Starting MapServer with Apache..."

# Execute the main command
exec "$@"