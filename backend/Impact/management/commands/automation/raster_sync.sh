#!/bin/bash

# SFTP Configuration from environment variables
SFTP_HOST="${SFTP_HOST:?'SFTP_HOST environment variable is not set'}"
SFTP_USER="${SFTP_USER:?'SFTP_USER environment variable is not set'}"
SFTP_PASS="${SFTP_PASS:?'SFTP_PASS environment variable is not set'}"
SFTP_REMOTE_PATH="${SFTP_PATH:-/path/to/raster/files}"  # Default path if not set

# GeoServer configuration
GEOSERVER_REST_URL="http://127.0.0.1:8082/geoserver/rest"
GEOSERVER_USER="admin"
GEOSERVER_PASS="geoserver"
WORKSPACE="your_workspace"
STORE_NAME="geotiff_store_$(date +%Y%m)"  # Auto-generate store name with year and month

# Local paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOWNLOAD_DIR="$PROJECT_ROOT/data/raster"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/raster_ingestion_$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p "$DOWNLOAD_DIR" "$LOG_DIR"

# Function to log messages
log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

# Function to check if required tools are installed
check_requirements() {
    local required_tools=("lftp" "curl" "jq")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_message "ERROR: Required tool '$tool' is not installed."
            exit 1
        fi
    done
}

# Function to check if workspace exists and create if needed
workspace_exists() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
        "$GEOSERVER_REST_URL/workspaces/$WORKSPACE")
    
    [ "$http_code" -eq 200 ]
}

create_workspace() {
    if ! workspace_exists; then
        log_message "Creating workspace $WORKSPACE..."
        curl -v -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
             -H "Content-type: application/json" \
             -d "{
               'workspace': {
                 'name': '$WORKSPACE'
               }
             }" \
             "$GEOSERVER_REST_URL/workspaces"
        
        if [ $? -eq 0 ]; then
            log_message "Workspace $WORKSPACE created successfully"
        else
            log_message "ERROR: Failed to create workspace"
            exit 1
        fi
    fi
}

# Function to create GeoTIFF store if it doesn't exist
create_store() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
        "$GEOSERVER_REST_URL/workspaces/$WORKSPACE/coveragestores/$STORE_NAME")
    
    if [ "$http_code" -ne 200 ]; then
        log_message "Creating GeoTIFF store $STORE_NAME..."
        curl -v -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
             -H "Content-type: application/json" \
             -d "{
               'coverageStore': {
                 'name': '$STORE_NAME',
                 'type': 'GeoTIFF',
                 'enabled': true,
                 'workspace': {
                   'name': '$WORKSPACE'
                 }
               }
             }" \
             "$GEOSERVER_REST_URL/workspaces/$WORKSPACE/coveragestores"
        
        if [ $? -eq 0 ]; then
            log_message "Store $STORE_NAME created successfully"
        else
            log_message "ERROR: Failed to create store"
            exit 1
        fi
    fi
}

# Function to download files from SFTP
download_from_sftp() {
    log_message "Starting SFTP download..."
    
    lftp -u "$SFTP_USER","$SFTP_PASS" sftp://"$SFTP_HOST" << EOF
        cd "$SFTP_REMOTE_PATH"
        mirror --parallel=3 --only-newer --verbose \
               --include "*.tif" --include "*.tiff" \
               . "$DOWNLOAD_DIR"
        quit
EOF
    
    if [ $? -eq 0 ]; then
        log_message "SFTP download completed successfully"
    else
        log_message "ERROR: SFTP download failed"
        exit 1
    fi
}

# Function to check if a coverage already exists in GeoServer
coverage_exists() {
    local coverage_name="$1"
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
        "$GEOSERVER_REST_URL/workspaces/$WORKSPACE/coveragestores/$STORE_NAME/coverages/$coverage_name")
    
    [ "$http_code" -eq 200 ]
}

# Function to ingest raster into GeoServer
ingest_to_geoserver() {
    local raster_file="$1"
    local coverage_name=$(basename "$raster_file" .tif)
    
    log_message "Processing $raster_file..."
    
    # Check if coverage already exists
    if coverage_exists "$coverage_name"; then
        log_message "Coverage $coverage_name already exists, updating..."
        local http_method="-X PUT"
    else
        log_message "Creating new coverage $coverage_name..."
        local http_method="-X POST"
    fi
    
    # Create coverage store and layer
    curl -v -u "$GEOSERVER_USER:$GEOSERVER_PASS" \
         $http_method \
         -H "Content-type: application/json" \
         -d "{
           'coverage': {
             'name': '$coverage_name',
             'title': '$coverage_name',
             'enabled': true,
             'parameters': {
               'entry': [
                 {'string': ['FileNamePath', '$raster_file']}
               ]
             }
           }
         }" \
         "$GEOSERVER_REST_URL/workspaces/$WORKSPACE/coveragestores/$STORE_NAME/coverages"
    
    if [ $? -eq 0 ]; then
        log_message "Successfully ingested $coverage_name into GeoServer"
    else
        log_message "ERROR: Failed to ingest $coverage_name"
    fi
}

# Main execution
main() {
    log_message "Starting raster data synchronization..."
    
    # Check requirements
    check_requirements
    
    # Ensure workspace exists
    create_workspace
    
    # Create store if needed
    create_store
    
    # Download new files from SFTP
    download_from_sftp
    
    # Process each raster file
    find "$DOWNLOAD_DIR" -type f \( -name "*.tif" -o -name "*.tiff" \) -print0 | 
    while IFS= read -r -d '' raster_file; do
        ingest_to_geoserver "$raster_file"
    done
    
    log_message "Raster data synchronization completed"
}

# Execute main function
main