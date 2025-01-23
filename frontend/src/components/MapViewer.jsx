import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, Popup, useMap, LayersControl, GeoJSON } from 'react-leaflet';
import { Form, ListGroup } from 'react-bootstrap';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/********************************************************************************
 * MAP CONFIGURATION
 *******************************************************************************/
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://localhost:8080/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
  popupWidth: 300,
  popupMaxHeight: 400,
  popupOffset: [0, -10]
};

/********************************************************************************
 * LAYER CONFIGURATION
 *******************************************************************************/
const createWMSLayer = (name, layerId, queryable = true) => ({
  name,
  layer: `floodwatch:${layerId}`,
  legend: `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
  queryable
});

const HAZARD_LAYERS = [
  createWMSLayer('Inundation Map', 'flood_hazard_map_floodproofs_202501210000'),
  createWMSLayer('Alerts Map', 'Alerts')
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

const BOUNDARY_LAYERS = [
  createWMSLayer('Admin 1', 'gha_admin1'),
  createWMSLayer('Admin 2', 'gha_admin2'),
  createWMSLayer('Protected Areas', 'protected_areas')
];

/********************************************************************************
 * BASE MAP CONFIGURATION
 *******************************************************************************/
const BASE_MAPS = [
  {
    name: 'ICPAC',
    url: 'https://eahazardswatch.icpac.net/tileserver-gl/styles/droughtwatch/{z}/{x}/{y}.png',
    attribution: '&copy; ICPAC_FloodWatch'
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

/********************************************************************************
 * UTILITY FUNCTIONS
 *******************************************************************************/
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

/********************************************************************************
 * FEATURE INFO COMPONENTS
 *******************************************************************************/
const FeatureInfoPopup = ({ info }) => {
  if (!info?.data?.length) return null;

  // Check if the data is for the sector
  const isSectorData = info.data.some(feature => feature.properties.sector);

  if (isSectorData) {
    // Prepare data for the chart
    const chartData = info.data.map(feature => ({
      sector: feature.properties.sector,
      value: feature.properties.value
    }));

    return (
      <div className="feature-popup">
        <h5 className="popup-title">Sector Data</h5>
        <BarChart width={300} height={200} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="sector" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </div>
    );
  }

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
            .map(([key, value]) => {
              // Append m³/s to Q Thr1, Q Thr2, and Q Thr3 values
              if (key === 'q_thr1' || key === 'q_thr2' || key === 'q_thr3') {
                value = `${formatFeatureValue(value)} m³/s`;
              }
              return (
                <div key={key} className="property-row">
                  <span className="property-label">{getPropertyLabel(key)}:</span>
                  <span className="property-value">{value}</span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
};

/********************************************************************************
 * MAP INTERACTION HANDLER
 *******************************************************************************/
const MapInteractionHandler = ({ selectedLayers, onFeatureClick }) => {
  const map = useMapEvents({
    click: async (e) => {
      if (!selectedLayers.size) return;

      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);

      const buffer = 8;
      const x = Math.round(point.x);
      const y = Math.round(point.y);

      try {
        const params = new URLSearchParams({
          REQUEST: 'GetFeatureInfo',
          SERVICE: 'WMS',
          VERSION: '1.1.1',
          LAYERS: Array.from(selectedLayers).join(','),
          QUERY_LAYERS: Array.from(selectedLayers).join(','),
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

/********************************************************************************
 * UI COMPONENTS
 *******************************************************************************/
const LayerSelector = ({ title, layers, selectedLayers, onLayerSelect }) => (
  <div className="layer-selector">
    <h4>{title}</h4>
    <ListGroup className="mb-4">
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name} className="layer-item">
          <Form.Check
            type="checkbox"
            name="layerSelection"
            id={`layer-${layer.name}`}
            label={layer.name}
            onChange={() => onLayerSelect(layer)}
            checked={selectedLayers.has(layer.layer)}
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

/********************************************************************************
 * MAIN MAP VIEWER COMPONENT
 *******************************************************************************/
const MapViewer = () => {
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [activeLegend, setActiveLegend] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [geoJsonData, setGeoJsonData] = useState(null);

  // Load GeoJSON data from the file
  useEffect(() => {
    fetch('/assets/merged_data.geojson')
      .then((response) => response.json())
      .then((data) => setGeoJsonData(data))
      .catch((error) => console.error('Error loading GeoJSON data:', error));
  }, []);

  const handleLayerSelection = useCallback((layer) => {
    const newSelectedLayers = new Set(selectedLayers);

    // Toggle the selected layer
    if (newSelectedLayers.has(layer.layer)) {
      newSelectedLayers.delete(layer.layer);
    } else {
      newSelectedLayers.add(layer.layer);
    }

    // If the selected layer is an Impact Layer (excluding SectorData), deselect all other layers
    if (
      IMPACT_LAYERS.some((impactLayer) => impactLayer.layer === layer.layer) &&
      layer.layer !== IMPACT_LAYERS.find((l) => l.name === 'SectorData')?.layer
    ) {
      // Deselect all other layers except SectorData
      HAZARD_LAYERS.forEach((hazardLayer) => {
        if (newSelectedLayers.has(hazardLayer.layer)) {
          newSelectedLayers.delete(hazardLayer.layer);
        }
      });
      BOUNDARY_LAYERS.forEach((boundaryLayer) => {
        if (newSelectedLayers.has(boundaryLayer.layer)) {
          newSelectedLayers.delete(boundaryLayer.layer);
        }
      });
      IMPACT_LAYERS.forEach((impactLayer) => {
        if (impactLayer.layer !== layer.layer && newSelectedLayers.has(impactLayer.layer)) {
          newSelectedLayers.delete(impactLayer.layer);
        }
      });
    }

    // If the selected layer is Inundation Map, deselect all Impact Layers (excluding SectorData)
    if (HAZARD_LAYERS.some((hazardLayer) => hazardLayer.layer === layer.layer)) {
      IMPACT_LAYERS.forEach((impactLayer) => {
        if (
          impactLayer.layer !== IMPACT_LAYERS.find((l) => l.name === 'SectorData')?.layer &&
          newSelectedLayers.has(impactLayer.layer)
        ) {
          newSelectedLayers.delete(impactLayer.layer);
        }
      });
    }

    // If the selected layer is SectorData, allow it to be selected with Boundary Layers or Inundation Map
    if (layer.layer === IMPACT_LAYERS.find((l) => l.name === 'SectorData')?.layer) {
      // No additional logic needed here
    }

    setSelectedLayers(newSelectedLayers);
    setActiveLegend(newSelectedLayers.has(layer.layer) ? layer.legend : null);
    setPopupInfo(null);
    setMapKey(prev => prev + 1);
  }, [selectedLayers]);

  const handleFeatureClick = useCallback((info) => {
    setPopupInfo(info);
  }, []);

  // Style for GeoJSON features
  const geoJsonStyle = {
    color: "#ff7800",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.7
  };

  // Function to handle click on GeoJSON features
  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const popupContent = Object.entries(feature.properties)
        .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
        .join('');
      layer.bindPopup(popupContent);
    }
  };

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <LayerSelector
          title="Inundation Map"
          layers={HAZARD_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />

        <LayerSelector
          title="Impact Layers"
          layers={IMPACT_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />

        <LayerSelector
          title="Boundary Layers"
          layers={BOUNDARY_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
        />
      </div>

      <div className="map-container">
        <MapContainer
          center={MAP_CONFIG.initialPosition}
          zoom={MAP_CONFIG.initialZoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <MapInteractionHandler
            selectedLayers={selectedLayers}
            onFeatureClick={handleFeatureClick}
          />

          <LayersControl position="topright">
            {BASE_MAPS.map((basemap) => (
              <LayersControl.BaseLayer
                key={basemap.name}
                name={basemap.name}
                checked={basemap.name === 'ICPAC'}
              >
                <TileLayer
                  url={basemap.url}
                  attribution={basemap.attribution}
                />
              </LayersControl.BaseLayer>
            ))}

            {Array.from(selectedLayers).map((layer) => (
              <LayersControl.Overlay
                key={layer}
                checked={true}
                name={layer.split(':')[1] || 'Custom Layer'}
              >
                <WMSTileLayer
                  key={`wms-${mapKey}`}
                  url={MAP_CONFIG.geoserverWMSUrl}
                  layers={layer}
                  format="image/png"
                  transparent={true}
                  attribution="GeoServer"
                  version="1.1.1"
                />
              </LayersControl.Overlay>
            ))}

            {/* Add GeoJSON Layer */}
            {geoJsonData && (
              <LayersControl.Overlay
                key="geojson-layer"
                checked={true}
                name="Merged Data"
              >
                <GeoJSON
                  data={geoJsonData}
                  style={geoJsonStyle}
                  onEachFeature={onEachFeature}
                />
              </LayersControl.Overlay>
            )}
          </LayersControl>

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
          height: calc(100vh - 160px); /* Account for navbar (100px) and footer (60px) */
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .sidebar {
          width: 300px;
          padding: 20px;
          background-color: #f8f9fa;
          overflow-y: auto;
          box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
          height: 100%;
          z-index: 1000;
        }

        .map-container {
          flex: 1;
          position: relative;
          height: 100%;
        }

        .map-legend {
          position: absolute;
          bottom: 40px; /* Increased to avoid footer overlap */
          left: 20px;
          background: white;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          max-height: calc(100vh - 260px); /* Adjust for navbar, footer, and padding */
          overflow-y: auto;
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
          color: #333;
        }

        .layer-item {
          padding: 8px 12px;
          border: 1px solid #dee2e6;
          margin-bottom: 4px;
          border-radius: 4px;
        }

        .layer-item:hover {
          background-color: #f8f9fa;
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

        .leaflet-bottom {
          bottom: 40.leaflet-bottom {
          bottom: 40px !important; /* Ensure controls don't overlap footer */
        }

        .leaflet-control-layers {
          background: white;
          padding: 6px;
          border-radius: 4px;
          box-shadow: 0 1px 5px rgba(0,0,0,0.2);
        }

        .leaflet-control-layers-list {
          margin-bottom: 0;
        }

        .leaflet-control-layers-expanded {
          padding: 8px 12px;
          background: white;
          border-radius: 4px;
        }

        .vector-layer-control {
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 16px;
        }

        /* Form control styling */
        .form-check {
          padding-left: 1.75rem;
        }

        .form-check-input {
          margin-top: 0.3rem;
        }

        .form-check-label {
          margin-left: 0.5rem;
          color: #333;
        }

        /* Responsive styles */
        @media (max-height: 768px) {
          .map-legend {
            max-height: calc(100vh - 300px);
          }

          .sidebar {
            max-height: calc(100vh - 160px);
          }
        }

        @media (max-width: 768px) {
          .map-viewer {
            flex-direction: column;
            height: calc(100vh - 160px);
          }

          .sidebar {
            width: 100%;
            max-height: 200px;
          }

          .map-container {
            height: calc(100% - 200px);
          }

          .map-legend {
            bottom: 60px;
            left: 10px;
            max-width: calc(100% - 20px);
          }

          .layer-selector h4 {
            font-size: 1rem;
          }

          .layer-item {
            padding: 6px 8px;
          }

          .property-row {
            flex-direction: column;
            gap: 4px;
          }

          .property-value {
            text-align: left;
          }
        }

        /* Print styles */
        @media print {
          .map-viewer {
            height: 100%;
          }

          .sidebar {
            display: none;
          }

          .map-container {
            width: 100%;
            height: 100%;
          }

          .map-legend {
            position: relative;
            bottom: auto;
            left: auto;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default MapViewer;