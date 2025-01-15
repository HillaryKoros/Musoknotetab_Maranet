// ============================================================================
// Core imports
// ============================================================================
import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, Popup } from 'react-leaflet';
import { Form, ListGroup } from 'react-bootstrap';
import 'leaflet/dist/leaflet.css';

// ============================================================================
// Configuration Constants
// ============================================================================
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://localhost:8080/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
  popupWidth: 300,
  popupMaxHeight: 400,
  popupOffset: [0, -10]
};

// REST API endpoints configuration
const REST_API_ENDPOINTS = {
  affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
  affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
  affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
  affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
  displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
  affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
  affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
};

// ============================================================================
// Layer Definitions
// ============================================================================
// Helper function to create WMS layer configurations
const createWMSLayer = (name, layerId, queryable = true) => ({
  name,
  layer: `floodwatch:${layerId}`,
  legend: `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
  queryable
});

// Impact layer definitions
const IMPACT_LAYERS = [
  createWMSLayer('Affected Population', 'Impact_affectedpopulation'),
  createWMSLayer('Affected GDP', 'Impact_impactedgdp'),
  createWMSLayer('Affected Crops', 'Impact_affectedcrops'),
  createWMSLayer('Affected Roads', 'Impact_affectedroads'),
  createWMSLayer('Displaced Population', 'Impact_displacedpopulation'),
  createWMSLayer('Affected Livestock', 'Impact_affectedlivestock'),
  createWMSLayer('Affected Grazing Land', 'Impact_affectedgrazingland'),
  createWMSLayer('SectorData', 'Impact_sectordata')
];

// Hazard and alert layer definitions
const HAZARD_ALERT_LAYERS = [
  createWMSLayer('Inundation Map', 'flood_hazard_map_floodproofs_202501030000'),
  createWMSLayer('Alerts Map', 'Alerts')
];

// Base map definitions
const BASE_MAPS = [
  {
    name: 'ICPAC',
    url: 'https://eahazardswatch.icpac.net/tileserver-gl/styles/droughtwatch/{z}/{x}/{y}.png',
    attribution: '&copy; IGAD-ICPAC_FloodWatch'

  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; ESRI, Maxar'
  },
  {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors'
  }
];

// ============================================================================
// Helper Functions
// ============================================================================
// Format feature value for display
const formatFeatureValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 6
    });
  }
  return value?.toString() || 'N/A';
};

// Get human-readable property name
const getPropertyLabel = (key) => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// ============================================================================
// UI Components
// ============================================================================
// Popup content component
const FeatureInfoPopup = ({ info }) => {
  if (!info?.data?.length) return null;
  
  return (
    <div className="feature-popup">
      <h5 className="popup-title">Layer Information</h5>
      {info.data.map((feature, index) => (
        <div key={index} className="feature-details">
          {Object.entries(feature.properties)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => (
              <div key={key} className="property-row">
                <span className="property-label">{getPropertyLabel(key)}:</span>
                <span className="property-value">{formatFeatureValue(value)}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
};

// Layer selection component
const LayerSelector = ({ title, layers, selectedLayer, onLayerSelect }) => (
  <div className="layer-selector">
    <h4>{title}</h4>
    <ListGroup className="mb-4">
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name}>
          <Form.Check
            type="radio"
            name="layerSelection"
            label={layer.name}
            onChange={() => onLayerSelect(layer)}
            checked={selectedLayer === layer.layer}
          />
        </ListGroup.Item>
      ))}
    </ListGroup>
  </div>
);

// Legend component
const Legend = ({ legendUrl }) => (
  <div className="map-legend">
    <h5>Legend</h5>
    <img src={legendUrl} alt="Legend" />
  </div>
);

// ============================================================================
// Map Interaction Handler
// ============================================================================
const LayerInteractionHandler = ({ selectedLayer, onFeatureClick }) => {
  const map = useMapEvents({
    click: async (e) => {
      if (!selectedLayer) return;
      
      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);
      
      try {
        // Construct GetFeatureInfo URL
        const getFeatureInfoUrl = `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetFeatureInfo&SERVICE=WMS` +
          `&VERSION=1.1.1&LAYERS=${selectedLayer}&QUERY_LAYERS=${selectedLayer}` +
          `&INFO_FORMAT=${MAP_CONFIG.getFeatureInfoFormat}&X=${Math.round(point.x)}` +
          `&Y=${Math.round(point.y)}&BBOX=${bounds.toBBoxString()}&WIDTH=${size.x}&HEIGHT=${size.y}` +
          `&SRS=EPSG:4326`;

        const response = await fetch(getFeatureInfoUrl);
        if (!response.ok) throw new Error('GetFeatureInfo request failed');
        
        const data = await response.json();
        
        // Only show popup if features were found
        if (data.features?.length > 0) {
          onFeatureClick({
            location: { lat, lng },
            data: data.features
          });
        }
      } catch (error) {
        console.error('GetFeatureInfo error:', error);
      }
    }
  });
  
  return null;
};

// ============================================================================
// Main Component
// ============================================================================
const MapViewer = () => {
  // State management
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [activeLegend, setActiveLegend] = useState(null);
  const [baseMap, setBaseMap] = useState(BASE_MAPS[0]);
  const [popupInfo, setPopupInfo] = useState(null);

  // Layer selection handler with debounce
  const handleLayerSelection = (layer) => {
    setSelectedLayer(null);
    setPopupInfo(null);
    
    setTimeout(() => {
      setSelectedLayer(layer.layer);
      setActiveLegend(layer.legend);
    }, 100);
  };

  // Feature click handler for popup
  const handleFeatureClick = useCallback((info) => {
    setPopupInfo(info);
  }, []);

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <LayerSelector
          title="Impact Layers"
          layers={IMPACT_LAYERS}
          selectedLayer={selectedLayer}
          onLayerSelect={handleLayerSelection}
        />
        
        <LayerSelector
          title="Inundation & Alert Maps"
          layers={HAZARD_ALERT_LAYERS}
          selectedLayer={selectedLayer}
          onLayerSelect={handleLayerSelection}
        />

        <h4>Base Maps</h4>
        <ListGroup>
          {BASE_MAPS.map((basemap, index) => (
            <ListGroup.Item key={basemap.name}>
              <Form.Check
                type="radio"
                name="basemapSelection"
                label={basemap.name}
                onChange={() => setBaseMap(BASE_MAPS[index])}
                checked={baseMap === basemap}
              />
            </ListGroup.Item>
          ))}
        </ListGroup>
      </div>

      <div className="map-container">
        <MapContainer
          center={MAP_CONFIG.initialPosition}
          zoom={MAP_CONFIG.initialZoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <LayerInteractionHandler 
            selectedLayer={selectedLayer}
            onFeatureClick={handleFeatureClick}
          />
          
          <TileLayer url={baseMap.url} attribution={baseMap.attribution} />
          
          {selectedLayer && (
            <WMSTileLayer
              key={selectedLayer}
              url={MAP_CONFIG.geoserverWMSUrl}
              layers={selectedLayer}
              format="image/png"
              transparent={true}
              attribution="GeoServer Floodwatch"
            />
          )}

          {popupInfo && (
            <Popup
              position={[popupInfo.location.lat, popupInfo.location.lng]}
              onClose={() => setPopupInfo(null)}
              offset={MAP_CONFIG.popupOffset}
              maxWidth={MAP_CONFIG.popupWidth}
              maxHeight={MAP_CONFIG.popupMaxHeight}
            >
              <FeatureInfoPopup info={popupInfo} />
            </Popup>
          )}
        </MapContainer>

        {activeLegend && <Legend legendUrl={activeLegend} />}
      </div>

      <style jsx global>{`
        .map-viewer {
          display: flex;
          height: 100vh;
          width: 100%;
        }

        .sidebar {
          width: 300px;
          padding: 20px;
          background-color: #f8f9fa;
          overflow-y: auto;
          box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
        }

        .map-container {
          flex: 1;
          position: relative;
        }

        .map-legend {
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: white;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          z-index: 1000;
        }

        .feature-popup {
          min-width: 200px;
          padding: 12px;
        }

        .popup-title {
          margin-bottom: 12px;
          font-weight: bold;
          border-bottom: 2px solid #eee;
          padding-bottom: 8px;
        }

        .feature-details {
          margin-bottom: 12px;
        }

        .property-row {
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .property-label {
          font-weight: 500;
          color: #666;
        }

        .property-value {
          text-align: right;
        }

        .layer-selector h4 {
          margin-bottom: 12px;
        }

        /* Leaflet popup customization */
        .leaflet-popup-content {
          margin: 0;
        }

        .leaflet-popup-content-wrapper {
          padding: 0;
        }
      `}</style>
    </div>
  );
};

export default MapViewer;