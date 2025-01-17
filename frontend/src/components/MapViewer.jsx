import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, Popup, useMap } from 'react-leaflet';
import { Form, ListGroup } from 'react-bootstrap';
import 'leaflet/dist/leaflet.css';

const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://localhost:8080/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
  popupWidth: 300,
  popupMaxHeight: 400,
  popupOffset: [0, -10]
};

const REST_API_ENDPOINTS = {
  affectedPop: 'http://127.0.0.1:8000/api/affectedPop/',
  affectedGDP: 'http://127.0.0.1:8000/api/affectedGDP/',
  affectedCrops: 'http://127.0.0.1:8000/api/affectedCrops/',
  affectedRoads: 'http://127.0.0.1:8000/api/affectedRoads/',
  displacedPop: 'http://127.0.0.1:8000/api/displacedPop/',
  affectedLivestock: 'http://127.0.0.1:8000/api/affectedLivestock/',
  affectedGrazingLand: 'http://127.0.0.1:8000/api/affectedGrazingLand/',
};

const createWMSLayer = (name, layerId, queryable = true) => ({
  name,
  layer: `floodwatch:${layerId}`,
  legend: `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
  queryable
});

const HAZARD_LAYERS = [
  createWMSLayer('Inundation Map', 'flood_hazard_map_floodproofs_202501030000'),
];

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

const formatFeatureValue = (value) => {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 6
    });
  }
  return value?.toString() || 'N/A';
};

const getPropertyLabel = (key) => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const FeatureInfoPopup = ({ info }) => {
  if (!info?.data?.length) return null;
  
  return (
    <div className="feature-popup">
      <h5 className="popup-title">Layer Information</h5>
      {info.data.map((feature, index) => (
        <div key={index} className="feature-details">
          {Object.entries(feature.properties)
            .filter(([key, value]) => (
              value !== null && 
              value !== undefined && 
              !key.startsWith('_') && 
              key !== 'bbox'
            ))
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

const MapInteractionHandler = ({ selectedLayer, onFeatureClick }) => {
  const map = useMapEvents({
    click: async (e) => {
      if (!selectedLayer) return;
      
      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);
      
      const buffer = 8; // Increased buffer size for better feature detection
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      
      try {
        const params = new URLSearchParams({
          REQUEST: 'GetFeatureInfo',
          SERVICE: 'WMS',
          VERSION: '1.1.1',
          LAYERS: selectedLayer,
          QUERY_LAYERS: selectedLayer,
          INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
          FEATURE_COUNT: '10',
          X: x.toString(),
          Y: y.toString(),
          BUFFER: buffer.toString(),
          BBOX: bounds.toBBoxString(),
          WIDTH: size.x.toString(),
          HEIGHT: size.y.toString(),
          SRS: 'EPSG:4326'
        });

        const getFeatureInfoUrl = `${MAP_CONFIG.geoserverWMSUrl}?${params.toString()}`;
        
        const response = await fetch(getFeatureInfoUrl);
        if (!response.ok) throw new Error('GetFeatureInfo request failed');
        
        const data = await response.json();
        
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

const LayerSelector = ({ title, layers, selectedLayer, onLayerSelect }) => (
  <div className="layer-selector">
    <h4>{title}</h4>
    <ListGroup className="mb-4">
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name} className="layer-item">
          <Form.Check
            type="radio"
            name="layerSelection"
            id={`layer-${layer.name}`}
            label={layer.name}
            onChange={() => onLayerSelect(layer)}
            checked={selectedLayer === layer.layer}
          />
        </ListGroup.Item>
      ))}
    </ListGroup>
  </div>
);

const Legend = ({ legendUrl }) => (
  <div className="map-legend">
    <h5>Legend</h5>
    <img src={legendUrl} alt="Legend" onError={(e) => e.target.style.display = 'none'} />
  </div>
);

const MapViewer = () => {
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [activeLegend, setActiveLegend] = useState(null);
  const [baseMap, setBaseMap] = useState(BASE_MAPS[0]);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapKey, setMapKey] = useState(0); // Key for forcing WMS layer refresh

  const handleLayerSelection = useCallback((layer) => {
    setSelectedLayer(layer.layer);
    setActiveLegend(layer.legend);
    setPopupInfo(null);
    setMapKey(prev => prev + 1); // Force WMS layer refresh
  }, []);

  const handleFeatureClick = useCallback((info) => {
    setPopupInfo(info);
  }, []);

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <LayerSelector
          title="Inundation Map"
          layers={HAZARD_LAYERS}
          selectedLayer={selectedLayer}
          onLayerSelect={handleLayerSelection}
        />
        
        <LayerSelector
          title="Impact Layers"
          layers={IMPACT_LAYERS}
          selectedLayer={selectedLayer}
          onLayerSelect={handleLayerSelection}
        />

        <h4>Base Maps</h4>
        <ListGroup>
          {BASE_MAPS.map((basemap) => (
            <ListGroup.Item key={basemap.name} className="basemap-item">
              <Form.Check
                type="radio"
                name="basemapSelection"
                id={`basemap-${basemap.name}`}
                label={basemap.name}
                onChange={() => setBaseMap(basemap)}
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
          <MapInteractionHandler 
            selectedLayer={selectedLayer}
            onFeatureClick={handleFeatureClick}
          />
          
          <TileLayer 
            url={baseMap.url} 
            attribution={baseMap.attribution} 
          />
          
          {selectedLayer && (
            <WMSTileLayer
              key={`wms-${mapKey}`}
              url={MAP_CONFIG.geoserverWMSUrl}
              layers={selectedLayer}
              format="image/png"
              transparent={true}
              attribution="GeoServer Floodwatch"
              version="1.1.1"
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

        .map-legend img {
          max-width: 200px;
          max-height: 300px;
        }

        .feature-popup {
          min-width: 200px;
          max-width: 300px;
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
          font-size: 0.9rem;
        }

        .property-label {
          font-weight: 500;
          color: #666;
        }

        .property-value {
          text-align: right;
          word-break: break-word;
        }

        .layer-selector h4 {
          margin-bottom: 12px;
        }

        .layer-item, .basemap-item {
          padding: 8px 12px;
        }

        .leaflet-popup-content {
          margin: 0;
          min-width: 200px;
        }

        .leaflet-popup-content-wrapper {
          padding: 0;
        }

        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
};

export default MapViewer;