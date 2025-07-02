#!/bin/bash

# Development setup script for optimal local builds
set -e

echo "🚀 Setting up flood watch system for local development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker &> /dev/null || ! docker compose version >/dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

print_status "Docker BuildKit enabled for faster builds"

# Create necessary directories if they don't exist
print_status "Creating necessary directories..."
mkdir -p mapcache/cache mapcache/locks
mkdir -p mapserver/data/rasters mapserver/timeseries_data mapserver/impact_shapefiles

# Set proper permissions (ignore errors for existing Docker volumes)
chmod 755 mapcache/cache mapcache/locks 2>/dev/null || print_warning "Could not change permissions on cache directories (normal if using Docker volumes)"
chmod 755 mapserver/data/rasters mapserver/timeseries_data mapserver/impact_shapefiles 2>/dev/null || true

# Pull registry images that rarely change
print_status "Pulling stable images from registry..."
docker compose pull db redis || print_warning "Could not pull some registry images, will build locally"

# Build development images with cache
print_status "Building services with optimized caching..."

# Use BuildKit cache mounts for faster builds
export BUILDKIT_PROGRESS=plain

# Build in parallel where possible
if make build-fast; then
    print_status "✅ Build completed successfully!"
else
    print_warning "Build had some issues, trying individual service builds..."
    
    # Try building services individually
    services=("web" "celery_worker" "celery_beat" "frontend" "mapserver" "mapcache")
    
    for service in "${services[@]}"; do
        print_status "Building $service..."
        if docker compose -f docker-compose.yml -f docker-compose.dev.yml build "$service"; then
            print_status "✅ $service built successfully"
        else
            print_error "❌ Failed to build $service"
        fi
    done
fi

# Start services
print_status "Starting services in development mode..."
if make up-dev; then
    print_status "✅ Services started successfully!"
    
    echo ""
    echo "🎉 Development environment is ready!"
    echo ""
    echo "📋 Available services:"
    echo "   • Frontend:     http://localhost:8094"
    echo "   • Backend API:  http://localhost:8090"
    echo "   • Database:     localhost:8091"
    echo "   • Redis:        localhost:8092"
    echo "   • MapServer:    http://localhost:8093"
    echo "   • MapCache:     http://localhost:8095"
    echo ""
    echo "🔧 Useful commands:"
    echo "   • make logs          - View all logs"
    echo "   • make logs-mapcache - View MapCache logs"
    echo "   • make restart       - Restart all services"
    echo "   • make down          - Stop all services"
    echo "   • make clean         - Clean up everything"
    echo ""
else
    print_error "❌ Failed to start services"
    print_status "Check logs with: make logs"
    exit 1
fi