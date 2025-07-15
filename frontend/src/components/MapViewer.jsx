import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  useMapEvents,
  useMap,
  LayersControl,
  GeoJSON,
  Popup,
} from "react-leaflet";
import { ListGroup, Nav, Tab, Modal, Button } from "react-bootstrap";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import L from "leaflet";
import { DischargeChart, GeoSFMChart } from "../utils/chartUtils.jsx";
import IBEWPopupHandler from "../utils/IBEWPopupHandler.jsx";

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// Configuration for the map's initial state and WMS server
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  mapserverWMSUrl: `http://197.254.1.10:8093/cgi-bin/mapserv?map=/etc/mapserver/master.map`,
  mapcacheWMSUrl: `http://197.254.1.10:8095/mapcache/wms`,
  mapcacheTMSUrl: `http://197.254.1.10:8095/mapcache/tms/1.0.0`,
  getFeatureInfoFormat: "application/json",
};

// Define the GeoJSON path based on environment
const GEOJSON_PATH = process.env.NODE_ENV === "production"
  ? "/timeseries_data/merged_data.geojson"
  : "/merged_data.geojson";

// Configuration for monitoring stations
const MONITORING_STATIONS_CONFIG = {
  style: {
    radius: 5,
    fillColor: "#3388ff",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
    selectedFillColor: "#ff4444",
  },
};

// Configuration for GeoSFM points
const GEOFSM_CONFIG = {
  style: {
    radius: 5,
    fillColor: "#b87c2c",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
    selectedFillColor: "#ff4444",
  },
};

// Metadata for layers - COMMENTED OUT FOR NOW
const LAYER_METADATA = {
  // Metadata will be added here later
};

// Helper function to handle layer loading errors
const handleLayerError = (layerId, error) => {
  console.error(`Error loading layer ${layerId}:`, error);
};

// Utility function to create WMS layer objects with date support
const createWMSLayer = (name, layerId, isMapServer = false, useCache = true, needsDate = false) => {
  const wmsUrl = (useCache && isMapServer) ? MAP_CONFIG.mapcacheWMSUrl : MAP_CONFIG.mapserverWMSUrl;
  
  // Build proper legend URL
  let legendUrl;
  if (isMapServer) {
    // For MapServer layers, ensure proper URL construction
    legendUrl = `${MAP_CONFIG.mapserverWMSUrl}&SERVICE=WMS&VERSION=1.1.0&REQUEST=GetLegendGraphic&LAYER=${layerId}&FORMAT=image/png&SLD_VERSION=1.1.0&STYLE=default`;
    
    // Add date parameters for date-based layers
    if (needsDate) {
      const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
      legendUrl += `&date=${currentDate}&datetime=${currentDate}0000`;
    }
  } else {
    // For non-MapServer layers (if you have any)
    legendUrl = `${MAP_CONFIG.geoserverWMSUrl}?SERVICE=WMS&VERSION=1.0.0&REQUEST=GetLegendGraphic&LAYER=floodwatch:${layerId}&FORMAT=image/png`;
  }
  
  return {
    name,
    layer: layerId,
    legend: legendUrl,
    isMapServer,
    useCache,
    wmsUrl,
    needsDate
  };
};

// Function to format layer ID with date - UPDATED for runtime substitution
const formatLayerIdWithDate = (baseLayerId, date, layerType) => {
  // For IBEW layers, DON'T modify the layer ID - use it as-is
  // The runtime substitution happens server-side via URL parameters
  if (layerType === 'ibew') {
    return baseLayerId; // Return "popafftot_%date%" as-is
  }
  
  if (!date) return baseLayerId;
  
  const formattedDate = date.replace(/-/g, '');
  
  switch(layerType) {
    case 'inundation':
      return `${baseLayerId}_${formattedDate}`;
    case 'impact':
      return `${baseLayerId}_${formattedDate}`; // FIXED: Added date support for impact layers
    default:
      return baseLayerId;
  }
};

// Impact layers - UPDATED: now with date support
const IMPACT_LAYERS = [
  createWMSLayer("Affected Population", "impact_population", true, true, true), // Changed to true
  createWMSLayer("Affected GDP", "impact_gdp", true, true, true), // Changed to true
  createWMSLayer("Affected Crops", "impact_crops", true, true, true), // Changed to true
  createWMSLayer("Affected Roads", "impact_roads", true, true, true), // Changed to true
  createWMSLayer("Displaced Population", "impact_displaced", true, true, true), // Changed to true
  createWMSLayer("Affected Livestock", "impact_livestock", true, true, true), // Changed to true
  createWMSLayer("Affected Grazing Land", "impact_grazing", true, true, true), // Changed to true
];

// IBEW Layers - UPDATED to use the exact layer names from GetCapabilities
const IBEW_LAYERS = [
  createWMSLayer("Health Facilities Affected", "healthtot_%date%", true, false, true),
  createWMSLayer("People Affected (100cm)", "popaff100_%date%", true, false, true),
  createWMSLayer("People Affected (25cm)", "popaff25_%date%", true, false, true),
  createWMSLayer("Total People Affected", "popafftot_%date%", true, false, true),
  createWMSLayer("Vulnerable Age Groups (100cm)", "popage100_%date%", true, false, true),
  createWMSLayer("Vulnerable Age Groups (25cm)", "popage25_%date%", true, false, true),
  createWMSLayer("Reduced Mobility (100cm)", "popmob100_%date%", true, false, true),
  createWMSLayer("Reduced Mobility (25cm)", "popmob25_%date%", true, false, true),
];

// Boundary layers (no date needed)
const BOUNDARY_LAYERS = [
  createWMSLayer("Admin 1", "admin_level_1", true, true, false),
  createWMSLayer("Admin 2", "admin_level_2", true, true, false),
  createWMSLayer("Lakes", "lakes", true, true, false),
  createWMSLayer("Rivers", "rivers", true, true, false),
  createWMSLayer("Basins", "basins", true, true, false),
];

const BASE_MAPS = [
  {
    name: "ICPAC",
    url: "https://eahazardswatch.icpac.net/tileserver-gl/styles/droughtwatch/{z}/{x}/{y}.png",
    attribution: "© ICPAC_FloodWatch",
  },
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© ESRI, Maxar",
  },
  {
    name: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap contributors",
  },
];

// Info icon component
const InfoIcon = ({ layerName, onClick }) => (
  <span 
    className="info-icon" 
    onClick={(e) => {
      e.stopPropagation();
      onClick(layerName);
    }}
    style={{
      cursor: 'pointer',
      marginLeft: '8px',
      fontSize: '14px',
      color: '#007bff',
      fontWeight: 'bold',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      border: '1px solid #007bff',
      lineHeight: '1'
    }}
  >
    i
  </span>
);

// Component to display metadata modal
const MetadataModal = ({ show, handleClose, metadata }) => {
  if (!metadata) return null;
  
  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title style={{ color: "#1B6840" }}>{metadata.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{metadata.description}</p>
        <ul className="mb-3">
          {metadata.details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
        <p><strong>Source:</strong> {metadata.source}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Component to render a layer selector with checkboxes and calendar
const LayerSelector = ({ title, layers, selectedLayers, onLayerSelect, onInfoClick, selectedDate, onDateChange, showCalendar = true }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  return (
    <div className="layers-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h6 style={{ margin: 0 }}>{title}</h6>
        {showCalendar && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                backgroundColor: '#007bff',
                border: '2px solid #007bff',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'white',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '140px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#0056b3';
                e.target.style.borderColor = '#0056b3';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#007bff';
                e.target.style.borderColor = '#007bff';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              📅 {selectedDate || new Date().toISOString().split('T')[0]}
            </button>
            {isCalendarOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                padding: '8px'
              }}>
                <input
                  type="date"
                  value={selectedDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    onDateChange(e.target.value);
                    setIsCalendarOpen(false);
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #007bff',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa',
                    color: '#495057',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0056b3';
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 0.2rem rgba(0, 123, 255, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#007bff';
                    e.target.style.backgroundColor = '#f8f9fa';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <ListGroup className="layer-selector">
        {layers.map((layer) => (
          <ListGroup.Item key={layer.name}>
            <div className="layer-content">
              <div className="toggle-switch-small">
                <input
                  type="checkbox"
                  id={`layer-${layer.name}`}
                  checked={selectedLayers.has(layer.layer)}
                  onChange={() => onLayerSelect(layer)}
                />
                <label
                  htmlFor={`layer-${layer.name}`}
                  className="toggle-slider-small"
                ></label>
              </div>
              <label htmlFor={`layer-${layer.name}`} className="layer-label">
                {layer.name}
              </label>
            </div>
            <InfoIcon layerName={layer.name} onClick={onInfoClick} />
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};

// FIXED MapLegend component - removes "Legend not available" text
const MapLegend = ({ legendUrl, title }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Reset states when legendUrl changes
  useEffect(() => {
    setImageError(false);
    setIsLoading(true);
  }, [legendUrl]);
  
  const needsCustomLegend = () =>
    title === "Hazard Map" ||
    title === "Inundation Map" ||
    legendUrl?.includes("Alerts") ||
    title === "GeoSFM" ||
    title === "Alerts Map" ||
    legendUrl?.includes("geofsm_layer");
    
  const legendData = needsCustomLegend()
    ? title === "GeoSFM" || legendUrl?.includes("geofsm_layer")
      ? {
          title: "GeoSFM",
          items: [
            { color: "#2c7fb8", label: "Low Risk" },
            { color: "#7fcdbb", label: "Medium Risk" },
            { color: "#edf8b1", label: "High Risk" },
          ],
        }
      : {
          title: "Hazard Map",
          items: [
            { color: "#FF0000", label: "High Hazard" },
            { color: "#FFFF00", label: "Medium hazard" },
            { color: "#45cbf7", label: "Low Hazard" },
          ],
        }
    : null;

  if (needsCustomLegend()) {
    return (
      <div className="map-legend">
        <h5>{legendData.title}</h5>
        {legendData.items.map((item, index) => (
          <div
            key={index}
            style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                backgroundColor: item.color,
                marginRight: "8px",
                border: "1px solid #ccc",
              }}
            />
            <span style={{ fontSize: "12px" }}>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }
  
  // FIXED: Only show legend if we have a valid URL and no error
  if (!legendUrl || imageError) {
    return null; // Return null instead of showing "Legend not available"
  }

  return (
    <div className="map-legend">
      <h5>{title}</h5>
      {isLoading && (
        <div style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: "#666" }}>
          Loading legend...
        </div>
      )}
      <img
        src={legendUrl}
        alt={`Legend for ${title}`}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          console.error(`Failed to load legend for ${title}:`, legendUrl);
          setImageError(true);
          setIsLoading(false);
        }}
        style={{ 
          display: isLoading ? 'none' : 'block',
          maxWidth: '100%',
          height: 'auto'
        }}
      />
    </div>
  );
};

// Component for the sidebar with tabs
const TabSidebar = ({
  hazardLayers,
  impactLayers,
  ibewLayers,
  boundaryLayers,
  selectedLayers,
  selectedBoundaryLayers,
  onLayerSelect,
  onBoundaryLayerSelect,
  showMonitoringStations,
  setShowMonitoringStations,
  showGeoFSM,
  setShowGeoFSM,
  geoFSMLoading,
  selectedYear,
  setSelectedYear,
  selectedStation,
  showMikeHydro,
  setShowMikeHydro,
  showFastFlood,
  setShowFastFlood,
  showGlofas,
  setShowGlofas,
  onInfoClick,
  selectedDate,
  onDateChange,
}) => {
  const [stationDate, setStationDate] = useState(new Date().toISOString().split('T')[0]);
  
  return (
    <div className="sidebar">
      <Tab.Container defaultActiveKey="forecast">
        <Nav variant="tabs" className="sidebar-tabs">
          <Nav.Item>
            <Nav.Link eventKey="forecast" className="tab-link">
              Sector Layers
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="monitoring" className="tab-link">
              Impact Layers
            </Nav.Link>
          </Nav.Item>
        </Nav>
        <Tab.Content>
          <Tab.Pane eventKey="forecast" className="tab-pane">
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: 0 }}>Station Information</h4>
            </div>
            <ListGroup className="mb-4">
              <ListGroup.Item>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="layer-content">
                    <div className="toggle-switch-small">
                      <input
                        type="checkbox"
                        id="monitoring-stations-toggle"
                        checked={showMonitoringStations}
                        onChange={() => setShowMonitoringStations((prev) => !prev)}
                      />
                      <label
                        htmlFor="monitoring-stations-toggle"
                        className="toggle-slider-small"
                      ></label>
                    </div>
                    <label htmlFor="monitoring-stations-toggle">
                      FloodProofs East Africa
                    </label>
                  </div>
                  <InfoIcon layerName="FloodProofs East Africa" onClick={onInfoClick} />
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="layer-content">
                      <div className="toggle-switch-small">
                        <input
                          type="checkbox"
                          id="geofsm-toggle"
                          checked={showGeoFSM}
                          onChange={() => setShowGeoFSM((prev) => !prev)}
                        />
                        <label
                          htmlFor="geofsm-toggle"
                          className="toggle-slider-small"
                        ></label>
                      </div>
                      <label htmlFor="geofsm-toggle">GeoSFM</label>
                    </div>
                    <InfoIcon layerName="GeoSFM" onClick={onInfoClick} />
                  </div>
                  {showGeoFSM && geoFSMLoading && (
                    <div style={{ marginLeft: "38px", marginTop: "8px" }}>
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading GeoSFM data...</span>
                      </div>
                      <small className="text-muted ms-2">Loading GeoSFM data...</small>
                    </div>
                  )}
                  {showGeoFSM && !geoFSMLoading && (
                    <div style={{ marginLeft: "38px", marginTop: "8px" }}>
                      <label htmlFor="year-select" style={{ fontSize: "0.875rem", marginRight: "8px" }}>
                        Year:
                      </label>
                      <select
                        id="year-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        style={{ 
                          fontSize: "0.875rem", 
                          padding: "2px 4px",
                          borderRadius: "4px",
                          border: "1px solid #ccc"
                        }}
                      >
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                      </select>
                    </div>
                  )}
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="layer-content">
                    <div className="toggle-switch-small">
                      <input
                        type="checkbox"
                        id="mike-hydro-toggle"
                        checked={showMikeHydro}
                        onChange={() => setShowMikeHydro(!showMikeHydro)}
                      />
                      <label
                        htmlFor="mike-hydro-toggle"
                        className="toggle-slider-small"
                      ></label>
                    </div>
                    <label htmlFor="mike-hydro-toggle">
                      Mike Hydro
                    </label>
                  </div>
                  <InfoIcon layerName="Mike Hydro" onClick={onInfoClick} />
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="layer-content">
                    <div className="toggle-switch-small">
                      <input
                        type="checkbox"
                        id="fast-flood-toggle"
                        checked={showFastFlood}
                        onChange={() => setShowFastFlood(!showFastFlood)}
                      />
                      <label
                        htmlFor="fast-flood-toggle"
                        className="toggle-slider-small"
                      ></label>
                    </div>
                    <label htmlFor="fast-flood-toggle">
                      Fast Flood
                    </label>
                  </div>
                  <InfoIcon layerName="Fast Flood" onClick={onInfoClick} />
                </div>
              </ListGroup.Item>
              <ListGroup.Item>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="layer-content">
                    <div className="toggle-switch-small">
                      <input
                        type="checkbox"
                        id="glofas-toggle"
                        checked={showGlofas}
                        onChange={() => setShowGlofas(!showGlofas)}
                      />
                      <label
                        htmlFor="glofas-toggle"
                        className="toggle-slider-small"
                      ></label>
                    </div>
                    <label htmlFor="glofas-toggle">
                      Glofas
                    </label>
                  </div>
                  <InfoIcon layerName="Glofas" onClick={onInfoClick} />
                </div>
              </ListGroup.Item>
            </ListGroup>
            {selectedStation && (
              <div className="station-characteristics">
                <h5>{selectedStation.properties?.SEC_NAME}</h5>
                <div className="characteristics-grid">
                  <div className="characteristic-item">
                    <span className="characteristic-label">Basin:</span>
                    <span className="characteristic-value">
                      {selectedStation.properties?.BASIN}
                    </span>
                  </div>
                  <div className="characteristic-item">
                    <span className="characteristic-label">Area:</span>
                    <span className="characteristic-value">
                      {selectedStation.properties?.AREA} km²
                    </span>
                  </div>
                  <div className="characteristic-item">
                    <span className="characteristic-label">Location:</span>
                    <span className="characteristic-value">
                      {selectedStation.properties?.latitude?.toFixed(4)}°N,{" "}
                      {selectedStation.properties?.longitude?.toFixed(4)}°E
                    </span>
                  </div>
                  <div className="characteristic-item">
                    <span className="characteristic-label">Alert Threshold:</span>
                    <span className="characteristic-value alert-threshold">
                      {selectedStation.properties?.Q_THR1} m³/s
                    </span>
                  </div>
                  <div className="characteristic-item">
                    <span className="characteristic-label">Alarm Threshold:</span>
                    <span className="characteristic-value alarm-threshold">
                      {selectedStation.properties?.Q_THR2} m³/s
                    </span>
                  </div>
                  <div className="characteristic-item">
                    <span className="characteristic-label">
                      Emergency Threshold:
                    </span>
                    <span className="characteristic-value emergency-threshold">
                      {selectedStation.properties?.Q_THR3} m³/s
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Tab.Pane>
          <Tab.Pane eventKey="monitoring" className="tab-pane">
            <LayerSelector
              title="Inundation Map"
              layers={hazardLayers}
              selectedLayers={selectedLayers}
              onLayerSelect={onLayerSelect}
              onInfoClick={onInfoClick}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
            />
            <LayerSelector
              title="Impact Layers"
              layers={impactLayers}
              selectedLayers={selectedLayers}
              onLayerSelect={onLayerSelect}
              onInfoClick={onInfoClick}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              showCalendar={true} // FIXED: Changed from false to true
            />
            <LayerSelector
              title="IBEW Layers"
              layers={ibewLayers}
              selectedLayers={selectedLayers}
              onLayerSelect={onLayerSelect}
              onInfoClick={onInfoClick}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
            />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

// UPDATED StableWMSLayer component to handle runtime substitution properly
const StableWMSLayer = React.memo(({ url, layers, transparent = true, format = "image/png", version = "1.1.0", zIndex = 100, layerConfig, selectedDate, layerType }) => {
  const [key, setKey] = useState(0);
  
  // For IBEW layers, don't modify the layer ID but add date parameters to URL
  const finalLayerId = React.useMemo(() => {
    if (layerType === 'ibew') {
      return layers; // Use layer name as-is: "popafftot_%date%"
    }
    return layerConfig?.needsDate && selectedDate ? 
      formatLayerIdWithDate(layers, selectedDate, layerType) : layers;
  }, [layers, layerConfig, selectedDate, layerType]);
  
  // Build URL with runtime substitution parameters for IBEW layers
  const finalUrl = React.useMemo(() => {
    if (layerType === 'ibew' && selectedDate) {
      const formattedDate = selectedDate.replace(/-/g, '');
      const urlParams = new URLSearchParams();
      urlParams.set('date', formattedDate);
      urlParams.set('datetime', `${formattedDate}0000`);
      
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${urlParams.toString()}`;
    }
    return url;
  }, [url, layerType, selectedDate]);
  
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [finalLayerId, selectedDate]);
  
  console.log(`Rendering WMS Layer: ${finalLayerId} with date: ${selectedDate}, URL: ${finalUrl}`);
  
  return (
    <WMSTileLayer
      key={`wms-${finalLayerId}-${selectedDate}-${key}`}
      url={finalUrl}
      layers={finalLayerId}
      format={format}
      transparent={transparent}
      version={version}
      updateWhenIdle={true}
      updateWhenZooming={false}
      updateInterval={200}
      keepBuffer={2}
      zIndex={zIndex}
      eventHandlers={{
        error: (error) => handleLayerError(finalLayerId, error),
        load: () => console.log(`Successfully loaded layer: ${finalLayerId}`)
      }}
    />
  );
});

// Main MapViewer component
const MapViewer = () => {
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [selectedBoundaryLayers, setSelectedBoundaryLayers] = useState(new Set([
    'rivers',
    'admin_level_1'
  ]));
  const [activeLegend, setActiveLegend] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [showMonitoringStations, setShowMonitoringStations] = useState(false);
  const [showGeoFSM, setShowGeoFSM] = useState(false);
  const [showMikeHydro, setShowMikeHydro] = useState(false);
  const [showFastFlood, setShowFastFlood] = useState(false);
  const [showGlofas, setShowGlofas] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [geoFSMData, setGeoFSMData] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [geoFSMTimeSeriesData, setGeoFSMTimeSeriesData] = useState([]);
  const [showChart, setShowChart] = useState(false);
  
  // Debug showChart changes
  useEffect(() => {
    console.log("showChart state changed:", showChart);
  }, [showChart]);
  const [chartType, setChartType] = useState("discharge");
  const [geoFSMDataType, setGeoFSMDataType] = useState("riverdepth");
  const [selectedSeries, setSelectedSeries] = useState("both");
  const [availableDataTypes, setAvailableDataTypes] = useState([]);
  const [geoFSMLoading, setGeoFSMLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2025");
  const [panelHeight, setPanelHeight] = useState(320);
  const [panelWidth, setPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  
  // State for metadata modal
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState(null);
  
  // State for unified date selection for all layers
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Handler for date changes - now applies to all layers
  const handleDateChange = (date) => {
    console.log(`Common date changed to: ${date}`);
    setSelectedDate(date);
    
    // Force map refresh when date changes
    setMapKey(prev => prev + 1);
  };

  // Handler for info icon clicks
  const handleInfoClick = (layerName) => {
    // For now, show a simple placeholder since metadata is empty
    const metadata = LAYER_METADATA[layerName] || {
      title: layerName,
      description: `Information about ${layerName}`,
      details: ["Details will be added soon"],
      source: "East Africa Flood Watch"
    };
    
    metadata.title = layerName;
    setCurrentMetadata(metadata);
    setShowMetadataModal(true);
  };

  // Handler for closing metadata modal
  const handleCloseMetadata = () => {
    setShowMetadataModal(false);
  };

  // Function to fetch GeoJSON data
  const fetchMonitoringData = useCallback(() => {
    console.log("Fetching monitoring data from:", GEOJSON_PATH);
    
    fetch(GEOJSON_PATH)
      .then((response) => {
        if (!response.ok) {
          console.error(`HTTP error! status: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Successfully loaded monitoring data, features:", data.features?.length);
        
        data.features.forEach((feature) => {
          if (feature.geometry?.coordinates) {
            feature.properties.latitude = feature.geometry.coordinates[1];
            feature.properties.longitude = feature.geometry.coordinates[0];
          }
        });
        
        setMonitoringData(data);
      })
      .catch((error) => {
        console.error("Error loading monitoring data:", error);
        setMonitoringData(null);
      });
  }, []);

  useEffect(() => {
    if (showMonitoringStations) {
      console.log("Initializing monitoring stations data");
      fetchMonitoringData();
      const interval = setInterval(fetchMonitoringData, 60000);
      return () => clearInterval(interval);
    } else {
      console.log("Monitoring stations disabled");
      setMonitoringData(null);
      setTimeSeriesData([]);
      setSelectedStation(null);
    }
  }, [showMonitoringStations, fetchMonitoringData]);

  useEffect(() => {
    if (showGeoFSM) {
      setGeoFSMLoading(true);
      fetch("hydro_data_with_locations.geojson")
        .then((response) => response.json())
        .then((data) => {
          // Filter for selected year data only to improve performance
          const filteredData = {
            ...data,
            features: data.features.filter((feature) => {
              return feature.properties.timestamp?.startsWith(selectedYear);
            })
          };
          
          filteredData.features.forEach((feature) => {
            if (feature.geometry?.coordinates) {
              feature.properties.latitude = feature.geometry.coordinates[1];
              feature.properties.longitude = feature.geometry.coordinates[0];
            }
          });
          setGeoFSMData(filteredData);
          const validTypes = ["riverdepth", "streamflow"];
          const dataTypes = [
            ...new Set(
              filteredData.features
                .map((f) => f.properties.data_type)
                .filter((type) => type && validTypes.includes(type)),
            ),
          ];
          setAvailableDataTypes(
            dataTypes.length > 0 ? dataTypes : ["riverdepth"],
          );
          setGeoFSMDataType(dataTypes[0] || "riverdepth");

          const allTimeSeries = filteredData.features
            .reduce((acc, f) => {
              const timestamp = new Date(f.properties.timestamp);
              if (isNaN(timestamp.getTime())) return acc;
              const existing = acc.find(
                (item) => item.timestamp.getTime() === timestamp.getTime(),
              );
              if (existing) {
                if (f.properties.data_type === "riverdepth")
                  existing.depth = Number(f.properties.value) || 0;
                else if (f.properties.data_type === "streamflow")
                  existing.streamflow = Number(f.properties.value) || 0;
              } else {
                acc.push({
                  timestamp,
                  depth:
                    f.properties.data_type === "riverdepth"
                      ? Number(f.properties.value) || 0
                      : 0,
                  streamflow:
                    f.properties.data_type === "streamflow"
                      ? Number(f.properties.value) || 0
                      : 0,
                });
              }
              return acc;
            }, [])
            .sort((a, b) => a.timestamp - b.timestamp);
          setGeoFSMTimeSeriesData(allTimeSeries);
          setGeoFSMLoading(false);
        })
        .catch((error) => {
          console.error("Error loading GeoSFM data:", error);
          setGeoFSMLoading(false);
        });
    } else {
      setGeoFSMData(null);
      setGeoFSMTimeSeriesData([]);
      setAvailableDataTypes([]);
      setSelectedStation(null);
      setGeoFSMLoading(false);
    }
  }, [showGeoFSM, selectedYear]);

  // Handle panel resizing
  const handleResizeStart = (direction, e) => {
    setIsResizing(true);
    setResizeDirection(direction);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !resizeDirection) return;
    
    const rect = document.querySelector('.bottom-panel').getBoundingClientRect();
    const minWidth = 400;
    const maxWidth = window.innerWidth - 100;
    const minHeight = 200;
    const maxHeight = window.innerHeight - 150;
    
    let newWidth = panelWidth;
    let newHeight = panelHeight;
    let newX = panelPosition.x;
    let newY = panelPosition.y;
    
    switch(resizeDirection) {
      case 'top':
        newHeight = rect.bottom - e.clientY;
        newY = e.clientY - 80;
        break;
      case 'bottom':
        newHeight = e.clientY - rect.top;
        break;
      case 'left':
        newWidth = rect.right - e.clientX;
        newX = e.clientX - 350;
        break;
      case 'right':
        newWidth = e.clientX - rect.left;
        break;
      case 'top-left':
        newHeight = rect.bottom - e.clientY;
        newWidth = rect.right - e.clientX;
        newY = e.clientY - 80;
        newX = e.clientX - 350;
        break;
      case 'top-right':
        newHeight = rect.bottom - e.clientY;
        newWidth = e.clientX - rect.left;
        newY = e.clientY - 80;
        break;
      case 'bottom-left':
        newHeight = e.clientY - rect.top;
        newWidth = rect.right - e.clientX;
        newX = e.clientX - 350;
        break;
      case 'bottom-right':
        newHeight = e.clientY - rect.top;
        newWidth = e.clientX - rect.left;
        break;
    }
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setPanelWidth(newWidth);
      if (['left', 'top-left', 'bottom-left'].includes(resizeDirection)) {
        setPanelPosition(prev => ({ ...prev, x: newX }));
      }
    }
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setPanelHeight(newHeight);
      if (['top', 'top-left', 'top-right'].includes(resizeDirection)) {
        setPanelPosition(prev => ({ ...prev, y: newY }));
      }
    }
  }, [isResizing, resizeDirection, panelWidth, panelHeight, panelPosition]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  // Handle panel dragging
  const handleDragStart = (e) => {
    setIsDragging(true);
    const rect = e.currentTarget.closest('.bottom-panel').getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const sidebarWidth = 350;
    
    const newX = Math.max(sidebarWidth, Math.min(windowWidth - 400, e.clientX - dragOffset.x));
    const newY = Math.max(80, Math.min(windowHeight - panelHeight - 30, e.clientY - dragOffset.y));
    
    setPanelPosition({ x: newX - sidebarWidth, y: newY });
  }, [isDragging, dragOffset, panelHeight]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      const cursorMap = {
        'top': 'ns-resize',
        'bottom': 'ns-resize',
        'left': 'ew-resize', 
        'right': 'ew-resize',
        'top-left': 'nw-resize',
        'top-right': 'ne-resize',
        'bottom-left': 'sw-resize',
        'bottom-right': 'se-resize'
      };
      
      document.body.style.cursor = cursorMap[resizeDirection] || 'default';
      document.body.style.userSelect = 'none';
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeDirection, isDragging, handleMouseMove, handleMouseUp, handleDragMove, handleDragEnd]);

  // Enhanced layer selection with proper date handling
  const handleLayerSelection = useCallback(
    (layer) => {
      setSelectedLayers((prev) => {
        const newSelectedLayers = new Set(prev);
        const isImpactLayer = IMPACT_LAYERS.some((l) => l.layer === layer.layer);
        const isIBEWLayer = IBEW_LAYERS.some((l) => l.layer === layer.layer);
        
        if (newSelectedLayers.has(layer.layer)) {
          newSelectedLayers.delete(layer.layer);
          if (activeLegend === layer.legend) setActiveLegend(null);
        } else {
          if (isImpactLayer) {
            IMPACT_LAYERS.forEach((l) => newSelectedLayers.delete(l.layer));
          }
          if (isIBEWLayer) {
            IBEW_LAYERS.forEach((l) => newSelectedLayers.delete(l.layer));
          }
          
          newSelectedLayers.add(layer.layer);
          setActiveLegend(layer.legend);
        }
        return newSelectedLayers;
      });
      
      setShowChart(false);
      setSelectedStation(null);
      setTimeSeriesData([]);
      setGeoFSMTimeSeriesData([]);
    },
    [activeLegend],
  );

  
  const handleBoundaryLayerSelection = useCallback(
    (layer) => {
      if (layer.layer === 'admin_level_1') {
        return;
      }
      
      setSelectedBoundaryLayers((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(layer.layer)) {
          newSelected.delete(layer.layer);
          if (activeLegend === layer.legend) setActiveLegend(null);
        } else {
          newSelected.add(layer.layer);
          setActiveLegend(layer.legend);
        }
        return newSelected;
      });
    },
    [activeLegend],
  );

  const handleStationClick = useCallback(
    (feature) => {
      console.log("Station clicked:", feature?.properties?.SEC_NAME || feature?.properties?.Name);
      setSelectedStation(feature);
      setShowChart(true);
      
      if (!feature?.properties) {
        console.log("No properties found in feature");
        return;
      }

      const dataType = feature.properties.data_type || "discharge";
      
      // For GeoSFM data, set chartType to indicate we're in GeoSFM mode
      if (dataType === "riverdepth" || dataType === "streamflow") {
        setChartType("riverdepth"); // Use riverdepth as the general GeoSFM indicator
        setGeoFSMDataType(dataType); // Set the specific data type
      } else {
        setChartType(dataType);
        setGeoFSMDataType(dataType === "discharge" ? "riverdepth" : dataType);
      }

      try {
        if (dataType === "riverdepth" || dataType === "streamflow") {
          const timeSeries =
            geoFSMData?.features
              ?.filter((f) => f.properties.Id === feature.properties.Id)
              .reduce((acc, f) => {
                const timestamp = new Date(f.properties.timestamp);
                if (isNaN(timestamp.getTime())) return acc;
                const existing = acc.find(
                  (item) => item.timestamp.getTime() === timestamp.getTime(),
                );
                if (existing) {
                  if (f.properties.data_type === "riverdepth")
                    existing.depth = Number(f.properties.value) || 0;
                  else if (f.properties.data_type === "streamflow")
                    existing.streamflow = Number(f.properties.value) || 0;
                } else {
                  acc.push({
                    timestamp,
                    depth:
                      f.properties.data_type === "riverdepth"
                        ? Number(f.properties.value) || 0
                        : 0,
                    streamflow:
                      f.properties.data_type === "streamflow"
                        ? Number(f.properties.value) || 0
                        : 0,
                  });
                }
                return acc;
              }, [])
              .sort((a, b) => a.timestamp - b.timestamp) || [];
          setGeoFSMTimeSeriesData(timeSeries);
          setTimeSeriesData([]);
          
          // Set available data types based on the selected station's data
          const stationDataTypes = [
            ...new Set(
              geoFSMData?.features
                ?.filter((f) => f.properties.Id === feature.properties.Id)
                .map((f) => f.properties.data_type)
                .filter((type) => type && ["riverdepth", "streamflow"].includes(type))
            )
          ];
          setAvailableDataTypes(stationDataTypes.length > 0 ? stationDataTypes : ["riverdepth"]);
        } else {
          console.log("Processing FloodPROOFS station:", feature?.properties?.SEC_NAME);
          console.log("Raw time period:", feature.properties.time_period);
          console.log("Raw GFS data:", feature.properties["time_series_discharge_simulated-gfs"]);
          console.log("Raw ICON data:", feature.properties["time_series_discharge_simulated-icon"]);
          
          const timePeriod =
            feature.properties.time_period?.split(",")?.map((t) => t.trim()) ||
            [];
          const gfsValues =
            feature.properties["time_series_discharge_simulated-gfs"]
              ?.split(",")
              .map((val) => Number(val.trim()) || 0) || [];
          const iconValues =
            feature.properties["time_series_discharge_simulated-icon"]
              ?.split(",")
              .map((val) => Number(val.trim()) || 0) || [];
              
          console.log("Parsed arrays - time:", timePeriod.length, "gfs:", gfsValues.length, "icon:", iconValues.length);

          const rawData = timePeriod
            .map((time, index) => ({
              time: new Date(time),
              gfs: gfsValues[index],
              icon: iconValues[index],
            }))
            .filter(
              (item) =>
                !isNaN(item.time.getTime()) &&
                !isNaN(item.gfs) &&
                !isNaN(item.icon),
            );
            
          console.log("Raw data before filtering:", rawData.length);
          console.log("Sample raw data:", rawData.slice(0, 3));

          // Aggregate data by day (daily averages)
          const dailyData = rawData.reduce((acc, item) => {
            const dateKey = item.time.toISOString().split('T')[0]; // Get YYYY-MM-DD format
            
            if (!acc[dateKey]) {
              acc[dateKey] = {
                date: new Date(dateKey),
                gfsValues: [],
                iconValues: []
              };
            }
            
            acc[dateKey].gfsValues.push(item.gfs);
            acc[dateKey].iconValues.push(item.icon);
            
            return acc;
          }, {});

          // Calculate daily averages
          const aggregatedData = Object.values(dailyData).map(day => ({
            time: day.date,
            gfs: day.gfsValues.reduce((sum, val) => sum + val, 0) / day.gfsValues.length,
            icon: day.iconValues.reduce((sum, val) => sum + val, 0) / day.iconValues.length
          })).sort((a, b) => a.time - b.time);

          console.log("Processed time series data:", aggregatedData.length, "daily points");
          setTimeSeriesData(aggregatedData);
          setGeoFSMTimeSeriesData([]);
        }
      } catch (error) {
        console.error("Error in handleStationClick:", error);
        setTimeSeriesData([]);
        setGeoFSMTimeSeriesData([]);
      }
    },
    [geoFSMData],
  );

  
  // Update hazard layers
  const hazardLayersWithDate = React.useMemo(() => [
    createWMSLayer("Inundation Map", `flood_hazard`, true, false, true),
    createWMSLayer("Alerts Map", "Alerts", true, false, false),
  ], []);

  // Get the appropriate date for a layer type
  const getDateForLayerType = (layerConfig) => {
    if (!layerConfig.needsDate) return null;
    
    // Return the unified date for all layers
    return selectedDate;
  };

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <TabSidebar
          hazardLayers={hazardLayersWithDate}
          impactLayers={IMPACT_LAYERS}
          ibewLayers={IBEW_LAYERS}
          boundaryLayers={BOUNDARY_LAYERS}
          selectedLayers={selectedLayers}
          selectedBoundaryLayers={selectedBoundaryLayers}
          onLayerSelect={handleLayerSelection}
          onBoundaryLayerSelect={handleBoundaryLayerSelection}
          showMonitoringStations={showMonitoringStations}
          setShowMonitoringStations={setShowMonitoringStations}
          showGeoFSM={showGeoFSM}
          setShowGeoFSM={setShowGeoFSM}
          geoFSMLoading={geoFSMLoading}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedStation={selectedStation}
          showMikeHydro={showMikeHydro}
          setShowMikeHydro={setShowMikeHydro}
          showFastFlood={showFastFlood}
          setShowFastFlood={setShowFastFlood}
          showGlofas={showGlofas}
          setShowGlofas={setShowGlofas}
          onInfoClick={handleInfoClick}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
        />
      </div>
      <div className="main-content">
        <div className="map-container" style={{
          bottom: (showChart && !panelPosition.x && !panelPosition.y) ? `${panelHeight + 30}px` : '30px'
        }}>
          <MapContainer
            center={MAP_CONFIG.initialPosition}
            zoom={MAP_CONFIG.initialZoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            key={mapKey}
          >
            <TileLayer
              url={BASE_MAPS[0].url}
              attribution={BASE_MAPS[0].attribution}
            />
            
            {/* Render WMS layers with proper date handling */}
            {Array.from(selectedLayers).map((layerId) => {
              const layerConfig = [
                ...hazardLayersWithDate, 
                ...IMPACT_LAYERS, 
                ...IBEW_LAYERS
              ].find(l => l.layer === layerId);
              
              if (!layerConfig) {
                console.warn(`Layer configuration not found for: ${layerId}`);
                return null;
              }
              
              const layerDate = getDateForLayerType(layerConfig);
              const layerType = IMPACT_LAYERS.some(l => l.layer === layerId) ? 'impact' :
                              IBEW_LAYERS.some(l => l.layer === layerId) ? 'ibew' :
                              layerId.includes('flood_hazard') ? 'inundation' : null;
              
              return (
                <StableWMSLayer
                  key={`layer-${layerId}-${layerDate || 'no-date'}`}
                  url={layerConfig.useCache ? MAP_CONFIG.mapcacheWMSUrl : MAP_CONFIG.mapserverWMSUrl}
                  layers={layerId}
                  transparent={true}
                  format="image/png"
                  version="1.1.0"
                  zIndex={100}
                  layerConfig={layerConfig}
                  selectedDate={layerDate}
                  layerType={layerType}
                />
              );
            })}

            {/* Boundary layers with MapCache */}
            {['lakes', 'rivers', 'basins'].map(layerId => 
              selectedBoundaryLayers.has(layerId) && (
                <StableWMSLayer
                  key={`boundary-${layerId}`}
                  url={MAP_CONFIG.mapcacheWMSUrl}
                  layers={layerId}
                  transparent={true}
                  format="image/png"
                  version="1.1.0"
                  zIndex={layerId === 'rivers' ? 50 : 200}
                  layerConfig={{ needsDate: false }}
                />
              )
            )}
            
            {/* Admin layers with highest z-index to ensure they're always on top */}
            {['admin_level_1', 'admin_level_2'].map((adminLayer, index) => 
              selectedBoundaryLayers.has(adminLayer) && (
                <StableWMSLayer
                  key={`boundary-${adminLayer}-top`}
                  url={MAP_CONFIG.mapcacheWMSUrl}
                  layers={adminLayer}
                  transparent={true}
                  format="image/png"
                  version="1.1.0"
                  zIndex={400 + index}
                  layerConfig={{ needsDate: false }}
                />
              )
            )}
            
            <LayersControl position="topright">
              {BASE_MAPS.map((basemap) => (
                <LayersControl.BaseLayer
                  key={basemap.name}
                  name={basemap.name}
                  checked={basemap.name === "ICPAC"}
                >
                  <TileLayer
                    url={basemap.url}
                    attribution={basemap.attribution}
                  />
                </LayersControl.BaseLayer>
              ))}
              
              {/* Boundary layers in layer control */}
              {BOUNDARY_LAYERS.map((layer) => (
                <LayersControl.Overlay
                  key={layer.layer}
                  name={layer.name}
                  checked={selectedBoundaryLayers.has(layer.layer)}
                >
                  <WMSTileLayer
                    url={MAP_CONFIG.mapserverWMSUrl}
                    layers={layer.layer}
                    format="image/png"
                    transparent={true}
                    version="1.1.0"
                    eventHandlers={{
                      add: () => setSelectedBoundaryLayers(prev => new Set([...prev, layer.layer])),
                      remove: () => {
                        if (layer.layer !== 'admin_level_1' && layer.layer !== 'rivers') {
                          setSelectedBoundaryLayers(prev => {
                            const newLayers = new Set(prev);
                            newLayers.delete(layer.layer);
                            return newLayers;
                          });
                        }
                      }
                    }}
                  />
                </LayersControl.Overlay>
              ))}
            </LayersControl>
            
            {showMonitoringStations && monitoringData?.features && (
              <GeoJSON
                key={`monitoring-stations-${selectedStation?.properties?.SEC_NAME || "none"}`}
                data={monitoringData}
                pointToLayer={(feature, latlng) => {
                  const isSelected =
                    selectedStation?.properties?.SEC_NAME ===
                    feature.properties.SEC_NAME;
                  return L.circleMarker(latlng, {
                    ...MONITORING_STATIONS_CONFIG.style,
                    fillColor: isSelected
                      ? MONITORING_STATIONS_CONFIG.style.selectedFillColor
                      : MONITORING_STATIONS_CONFIG.style.fillColor,
                  });
                }}
                onEachFeature={(feature, layer) => {
                  layer.on({ click: () => handleStationClick(feature) });
                  const props = feature.properties;
                  layer.bindPopup(
                    `<div class="station-popup"><strong>${props.SEC_NAME || "Station"}</strong><br/>Basin: ${props.BASIN || "N/A"}<br/>Current Status: ${props.status || "Normal"}</div>`,
                  );
                }}
              />
            )}
            {showGeoFSM && geoFSMData?.features && (
              <GeoJSON
                key={`geofsm-points-${geoFSMData.features.length}`}
                data={geoFSMData}
                pointToLayer={(feature, latlng) => {
                  const isSelected =
                    selectedStation?.properties?.Id === feature.properties.Id;
                  return L.circleMarker(latlng, {
                    ...GEOFSM_CONFIG.style,
                    fillColor: isSelected
                      ? GEOFSM_CONFIG.style.selectedFillColor
                      : GEOFSM_CONFIG.style.fillColor,
                  });
                }}
                onEachFeature={(feature, layer) => {
                  const props = feature.properties;
                  layer.bindPopup(
                    `<div class="geofsm-popup"><strong>${props.Name || "GeoFSM Point"}</strong><br/>Description: ${props.Descriptio || "N/A"}<br/>Gridcode: ${props.Gridcode || "N/A"}<br/>Latitude: ${props.Y?.toFixed(4) || "N/A"}°N<br/>Longitude: ${props.X?.toFixed(4) || "N/A"}°E<br/>ID: ${props.Id || "N/A"}</div>`,
                  );
                  layer.on({ click: () => handleStationClick(feature) });
                }}
              />
            )}
            
            {/* IBEW Popup Handler - replaces old FeatureInfoHandler */}
            <IBEWPopupHandler
              selectedLayers={selectedLayers}
              selectedDate={selectedDate}
              mapConfig={MAP_CONFIG}
            />
            
          </MapContainer>
          {/* Temporarily disabled legend until repaired */}
          {/* {activeLegend && (
            <div className="map-legend" style={{ 
              position: 'absolute', 
              bottom: '20px', 
              right: '20px', 
              backgroundColor: 'white', 
              padding: '15px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxWidth: '300px'
            }}>
              <MapLegend
                legendUrl={activeLegend}
                title={
                  [...hazardLayersWithDate, ...IMPACT_LAYERS, ...IBEW_LAYERS, ...BOUNDARY_LAYERS].find(
                    (layer) => layer.legend === activeLegend,
                  )?.name || "Legend"
                }
              />
            </div>
          )} */}
        </div>
        {showChart && (
          <div className="bottom-panel" style={{
            position: 'fixed',
            bottom: panelPosition.y ? 'auto' : '30px',
            top: panelPosition.y ? `${panelPosition.y}px` : 'auto',
            left: `${350 + panelPosition.x}px`,
            right: (panelPosition.x || panelPosition.y) ? 'auto' : '0px',
            width: (panelPosition.x || panelPosition.y) ? `${panelWidth}px` : 'auto',
            height: `${panelHeight}px`,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderBottom: 'none',
            borderTop: '2px solid #1B6840',
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1100,
            display: 'block',
            borderRadius: (panelPosition.x || panelPosition.y) ? '8px' : '0'
          }}>
            {/* Resize Handles - only show when panel is dragged/floating */}
            {(panelPosition.x || panelPosition.y) && (
              <>
                {/* Top */}
                <div
                  onMouseDown={(e) => handleResizeStart('top', e)}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: '8px',
                    right: '8px',
                    height: '8px',
                    cursor: 'ns-resize',
                    backgroundColor: 'transparent',
                    zIndex: 902
                  }}
                />
                {/* Bottom */}
                <div
                  onMouseDown={(e) => handleResizeStart('bottom', e)}
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '8px',
                    right: '8px',
                    height: '8px',
                    cursor: 'ns-resize',
                    backgroundColor: 'transparent',
                    zIndex: 902
                  }}
                />
                {/* Left */}
                <div
                  onMouseDown={(e) => handleResizeStart('left', e)}
                  style={{
                    position: 'absolute',
                    left: '-4px',
                    top: '8px',
                    bottom: '8px',
                    width: '8px',
                    cursor: 'ew-resize',
                    backgroundColor: 'transparent',
                    zIndex: 902
                  }}
                />
                {/* Right */}
                <div
                  onMouseDown={(e) => handleResizeStart('right', e)}
                  style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '8px',
                    bottom: '8px',
                    width: '8px',
                    cursor: 'ew-resize',
                    backgroundColor: 'transparent',
                    zIndex: 902
                  }}
                />
                {/* Top-Left Corner */}
                <div
                  onMouseDown={(e) => handleResizeStart('top-left', e)}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: '-4px',
                    width: '12px',
                    height: '12px',
                    cursor: 'nw-resize',
                    backgroundColor: 'transparent',
                    zIndex: 903
                  }}
                />
                {/* Top-Right Corner */}
                <div
                  onMouseDown={(e) => handleResizeStart('top-right', e)}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    cursor: 'ne-resize',
                    backgroundColor: 'transparent',
                    zIndex: 903
                  }}
                />
                {/* Bottom-Left Corner */}
                <div
                  onMouseDown={(e) => handleResizeStart('bottom-left', e)}
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '-4px',
                    width: '12px',
                    height: '12px',
                    cursor: 'sw-resize',
                    backgroundColor: 'transparent',
                    zIndex: 903
                  }}
                />
                {/* Bottom-Right Corner */}
                <div
                  onMouseDown={(e) => handleResizeStart('bottom-right', e)}
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    cursor: 'se-resize',
                    backgroundColor: 'transparent',
                    zIndex: 903
                  }}
                />
              </>
            )}
            
            {/* Original resize handle for docked position */}
            {!panelPosition.x && !panelPosition.y && (
              <div
                onMouseDown={(e) => handleResizeStart('top', e)}
                style={{
                  position: 'absolute',
                  top: '-5px',
                  left: '0',
                  right: '0',
                  height: '10px',
                  cursor: 'ns-resize',
                  backgroundColor: 'transparent',
                  zIndex: 901,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div style={{
                  width: '80px',
                  height: '4px',
                  backgroundColor: '#ccc',
                  borderRadius: '2px',
                  transition: 'background-color 0.2s'
                }} 
                onMouseEnter={(e) => e.target.style.backgroundColor = '#999'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ccc'}
                />
              </div>
            )}
            <div 
              className="chart-header" 
              onMouseDown={handleDragStart}
              style={{
                cursor: 'move',
                userSelect: 'none',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderBottom: '1px solid #ddd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '2px',
                  opacity: 0.6 
                }}>
                  <div style={{ width: '4px', height: '4px', backgroundColor: '#666', borderRadius: '50%' }}></div>
                  <div style={{ width: '4px', height: '4px', backgroundColor: '#666', borderRadius: '50%' }}></div>
                  <div style={{ width: '4px', height: '4px', backgroundColor: '#666', borderRadius: '50%' }}></div>
                </div>
                <h5 style={{ margin: 0 }}>
                  {selectedStation?.properties?.SEC_NAME ||
                    (chartType === "riverdepth" || chartType === "streamflow"
                      ? `${selectedStation?.properties?.Name || selectedStation?.properties?.Descriptio || 'GeoSFM Station'} - ${geoFSMDataType === 'riverdepth' ? 'River Depth' : 'Streamflow'}`
                      : "Discharge Forecast")}
                </h5>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {(chartType === "riverdepth" || chartType === "streamflow") && (
                  <div 
                    className="chart-controls" 
                    style={{ zIndex: 1000, position: 'relative' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={geoFSMDataType}
                      onChange={(e) => {
                        setGeoFSMDataType(e.target.value);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#BBDEFB";
                        e.target.style.borderColor = "#0D47A1";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "#E3F2FD";
                        e.target.style.borderColor = "#1976D2";
                      }}
                      style={{ 
                        marginRight: "10px", 
                        padding: "6px 12px",
                        border: "2px solid #1976D2",
                        borderRadius: "4px",
                        backgroundColor: "#E3F2FD",
                        color: "#1976D2",
                        fontWeight: "500",
                        minWidth: "140px",
                        fontSize: "14px",
                        cursor: "pointer",
                        zIndex: 1001,
                        position: "relative",
                        pointerEvents: "auto",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <option value="riverdepth">River Depth</option>
                      <option value="streamflow">Streamflow</option>
                    </select>
                  </div>
                )}
                
                {/* Export buttons */}
                <button
                  onClick={() => {
                    if (chartType === "riverdepth" || chartType === "streamflow") {
                      const stationName = selectedStation?.properties?.Name || selectedStation?.properties?.Descriptio || 'GeoSFM Station';
                      const csvData = geoFSMTimeSeriesData.map(item => ({
                        Date: new Date(item.timestamp).toISOString().split('T')[0],
                        [`${chartType === 'riverdepth' ? 'River Depth' : 'Streamflow'} (${chartType === 'riverdepth' ? 'm' : 'm³/s'})`]: item[chartType === 'riverdepth' ? 'depth' : 'streamflow'] || ''
                      }));
                      const headers = Object.keys(csvData[0]).join(',');
                      const csvContent = [
                        `# ${stationName} - ${chartType}`,
                        `# Generated on: ${new Date().toLocaleString()}`,
                        headers,
                        ...csvData.map(row => Object.values(row).join(','))
                      ].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${stationName}_${chartType}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } else {
                      const stationName = selectedStation?.properties?.SEC_NAME || 'FloodProofs Station';
                      const csvData = timeSeriesData.map(item => ({
                        Date: item.time.toISOString().split('T')[0],
                        'GFS Forecast (m³/s)': item.gfs || '',
                        'ICON Forecast (m³/s)': item.icon || ''
                      }));
                      const headers = Object.keys(csvData[0]).join(',');
                      const csvContent = [
                        `# ${stationName} - discharge_forecast`,
                        `# Generated on: ${new Date().toLocaleString()}`,
                        headers,
                        ...csvData.map(row => Object.values(row).join(','))
                      ].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${stationName}_discharge_forecast.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  📊 CSV
                </button>
                
                <button
                  onClick={() => {
                    // FloodProofs: Create professional 3-chart layout
                    if (chartType === "discharge" && timeSeriesData && timeSeriesData.length > 0) {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      
                      canvas.width = 1200;
                      canvas.height = 900;
                      
                      // Fill background
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      
                      const stationName = selectedStation?.properties?.SEC_NAME || 'FloodProofs Station';
                      
                      // Header section
                      ctx.fillStyle = '#f8f9fa';
                      ctx.fillRect(0, 0, canvas.width, 80);
                      ctx.strokeStyle = '#dee2e6';
                      ctx.lineWidth = 1;
                      ctx.strokeRect(0, 0, canvas.width, canvas.height);
                      ctx.strokeRect(0, 0, canvas.width, 80);
                      
                      // Title
                      ctx.fillStyle = '#1B6840';
                      ctx.font = 'bold 20px Arial';
                      ctx.fillText(`${stationName} - Discharge Forecast Analysis`, 20, 25);
                      
                      // Station details
                      ctx.fillStyle = '#333';
                      ctx.font = '12px Arial';
                      const basin = selectedStation?.properties?.BASIN || 'N/A';
                      const area = selectedStation?.properties?.AREA || 'N/A';
                      const lat = selectedStation?.properties?.latitude?.toFixed(4) || 'N/A';
                      const lng = selectedStation?.properties?.longitude?.toFixed(4) || 'N/A';
                      
                      ctx.fillText(`Basin: ${basin} | Area: ${area} km² | Location: ${lat}°N, ${lng}°E`, 20, 45);
                      
                      // Thresholds
                      const alertThreshold = selectedStation?.properties?.Q_THR1 || 'N/A';
                      const alarmThreshold = selectedStation?.properties?.Q_THR2 || 'N/A';
                      const emergencyThreshold = selectedStation?.properties?.Q_THR3 || 'N/A';
                      
                      ctx.fillStyle = '#ff9800';
                      ctx.fillText(`Alert: ${alertThreshold} m³/s`, 20, 62);
                      ctx.fillStyle = '#f44336';
                      ctx.fillText(`| Alarm: ${alarmThreshold} m³/s`, 150, 62);
                      ctx.fillStyle = '#d32f2f';
                      ctx.fillText(`| Emergency: ${emergencyThreshold} m³/s`, 300, 62);
                      
                      // Branding
                      ctx.fillStyle = '#1B6840';
                      ctx.font = 'bold 14px Arial';
                      ctx.fillText('East Africa Flood Watch | IGAD-ICPAC', canvas.width - 320, 25);
                      ctx.fillStyle = '#666';
                      ctx.font = '10px Arial';
                      ctx.fillText(`Generated: ${new Date().toLocaleString()}`, canvas.width - 200, 45);
                      
                      // Chart dimensions
                      const chartWidth = 540;
                      const chartHeight = 240;
                      const margin = { top: 40, right: 40, bottom: 60, left: 80 };
                      
                      // Helper function to draw professional chart
                      const drawProfessionalChart = (x, y, data, title, isLine = true, modelKey = null) => {
                        // Chart background
                        ctx.fillStyle = 'white';
                        ctx.fillRect(x, y, chartWidth, chartHeight);
                        ctx.strokeStyle = '#e0e0e0';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x, y, chartWidth, chartHeight);
                        
                        // Plot area
                        const plotX = x + margin.left;
                        const plotY = y + margin.top;
                        const plotWidth = chartWidth - margin.left - margin.right;
                        const plotHeight = chartHeight - margin.top - margin.bottom;
                        
                        // Title
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 14px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(title, x + chartWidth / 2, y + 20);
                        ctx.textAlign = 'left';
                        
                        if (isLine) {
                          // Line chart for individual models
                          const maxValue = Math.max(...data.map(d => d[modelKey]));
                          const yScale = plotHeight / (maxValue * 1.1);
                          const xScale = plotWidth / (data.length - 1);
                          
                          // Grid lines
                          ctx.strokeStyle = '#f0f0f0';
                          ctx.lineWidth = 1;
                          for (let i = 0; i <= 5; i++) {
                            const gridY = plotY + plotHeight - (i * plotHeight / 5);
                            ctx.beginPath();
                            ctx.moveTo(plotX, gridY);
                            ctx.lineTo(plotX + plotWidth, gridY);
                            ctx.stroke();
                          }
                          
                          // Y-axis
                          ctx.strokeStyle = '#333';
                          ctx.lineWidth = 2;
                          ctx.beginPath();
                          ctx.moveTo(plotX, plotY);
                          ctx.lineTo(plotX, plotY + plotHeight);
                          ctx.stroke();
                          
                          // X-axis
                          ctx.beginPath();
                          ctx.moveTo(plotX, plotY + plotHeight);
                          ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
                          ctx.stroke();
                          
                          // Y-axis labels
                          ctx.fillStyle = '#666';
                          ctx.font = '10px Arial';
                          ctx.textAlign = 'right';
                          for (let i = 0; i <= 5; i++) {
                            const value = (maxValue * i) / 5;
                            const labelY = plotY + plotHeight - (i * plotHeight / 5);
                            ctx.fillText(value.toFixed(1), plotX - 10, labelY + 3);
                          }
                          
                          // Y-axis title
                          ctx.save();
                          ctx.translate(plotX - 50, plotY + plotHeight / 2);
                          ctx.rotate(-Math.PI / 2);
                          ctx.font = 'bold 12px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText('Discharge (m³/s)', 0, 0);
                          ctx.restore();
                          
                          // X-axis labels (dates)
                          ctx.textAlign = 'center';
                          ctx.font = '9px Arial';
                          data.forEach((point, i) => {
                            if (i % Math.ceil(data.length / 6) === 0) {
                              const labelX = plotX + (i * xScale);
                              ctx.save();
                              ctx.translate(labelX, plotY + plotHeight + 15);
                              ctx.rotate(-Math.PI / 6);
                              ctx.fillText(point.time.toLocaleDateString('en-GB'), 0, 0);
                              ctx.restore();
                            }
                          });
                          
                          // Draw line
                          const color = modelKey === 'gfs' ? '#1f77b4' : '#ff7f0e';
                          ctx.strokeStyle = color;
                          ctx.lineWidth = 3;
                          ctx.beginPath();
                          
                          data.forEach((point, i) => {
                            const pointX = plotX + (i * xScale);
                            const pointY = plotY + plotHeight - (point[modelKey] * yScale);
                            
                            if (i === 0) ctx.moveTo(pointX, pointY);
                            else ctx.lineTo(pointX, pointY);
                          });
                          ctx.stroke();
                          
                          // Draw points
                          ctx.fillStyle = color;
                          data.forEach((point, i) => {
                            const pointX = plotX + (i * xScale);
                            const pointY = plotY + plotHeight - (point[modelKey] * yScale);
                            ctx.beginPath();
                            ctx.arc(pointX, pointY, 3, 0, 2 * Math.PI);
                            ctx.fill();
                          });
                        } else {
                          // Bar chart for comparison
                          const recentData = data.slice(-7);
                          const maxValue = Math.max(...recentData.flatMap(d => [d.gfs, d.icon]));
                          const yScale = plotHeight / (maxValue * 1.1);
                          const barGroupWidth = plotWidth / recentData.length;
                          const barWidth = barGroupWidth * 0.35;
                          
                          // Grid lines
                          ctx.strokeStyle = '#f0f0f0';
                          ctx.lineWidth = 1;
                          for (let i = 0; i <= 5; i++) {
                            const gridY = plotY + plotHeight - (i * plotHeight / 5);
                            ctx.beginPath();
                            ctx.moveTo(plotX, gridY);
                            ctx.lineTo(plotX + plotWidth, gridY);
                            ctx.stroke();
                          }
                          
                          // Axes
                          ctx.strokeStyle = '#333';
                          ctx.lineWidth = 2;
                          ctx.beginPath();
                          ctx.moveTo(plotX, plotY);
                          ctx.lineTo(plotX, plotY + plotHeight);
                          ctx.moveTo(plotX, plotY + plotHeight);
                          ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
                          ctx.stroke();
                          
                          // Y-axis labels
                          ctx.fillStyle = '#666';
                          ctx.font = '10px Arial';
                          ctx.textAlign = 'right';
                          for (let i = 0; i <= 5; i++) {
                            const value = (maxValue * i) / 5;
                            const labelY = plotY + plotHeight - (i * plotHeight / 5);
                            ctx.fillText(value.toFixed(1), plotX - 10, labelY + 3);
                          }
                          
                          // Y-axis title
                          ctx.save();
                          ctx.translate(plotX - 50, plotY + plotHeight / 2);
                          ctx.rotate(-Math.PI / 2);
                          ctx.font = 'bold 12px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText('Discharge (m³/s)', 0, 0);
                          ctx.restore();
                          
                          // Draw bars
                          recentData.forEach((dataPoint, i) => {
                            const groupX = plotX + (i * barGroupWidth) + barGroupWidth * 0.1;
                            
                            // GFS bar
                            const gfsHeight = dataPoint.gfs * yScale;
                            ctx.fillStyle = '#1f77b4';
                            ctx.fillRect(groupX, plotY + plotHeight - gfsHeight, barWidth, gfsHeight);
                            
                            // ICON bar
                            const iconHeight = dataPoint.icon * yScale;
                            ctx.fillStyle = '#ff7f0e';
                            ctx.fillRect(groupX + barWidth + 2, plotY + plotHeight - iconHeight, barWidth, iconHeight);
                            
                            // Date label
                            ctx.fillStyle = '#666';
                            ctx.font = '9px Arial';
                            ctx.textAlign = 'center';
                            ctx.save();
                            ctx.translate(groupX + barWidth, plotY + plotHeight + 15);
                            ctx.rotate(-Math.PI / 6);
                            ctx.fillText(dataPoint.time.toLocaleDateString('en-GB'), 0, 0);
                            ctx.restore();
                          });
                        }
                        ctx.textAlign = 'left';
                      };
                      
                      // Draw charts
                      drawProfessionalChart((canvas.width - chartWidth) / 2, 100, timeSeriesData, 'Model Comparison (Last 7 Days)', false);
                      drawProfessionalChart(30, 380, timeSeriesData, 'GFS Model Forecast', true, 'gfs');
                      drawProfessionalChart(630, 380, timeSeriesData, 'ICON Model Forecast', true, 'icon');
                      
                      // Legend
                      const legendY = 650;
                      ctx.fillStyle = '#1f77b4';
                      ctx.fillRect(canvas.width / 2 - 80, legendY, 15, 15);
                      ctx.fillStyle = '#333';
                      ctx.font = '12px Arial';
                      ctx.fillText('GFS Model', canvas.width / 2 - 60, legendY + 12);
                      
                      ctx.fillStyle = '#ff7f0e';
                      ctx.fillRect(canvas.width / 2 + 10, legendY, 15, 15);
                      ctx.fillText('ICON Model', canvas.width / 2 + 30, legendY + 12);
                      
                      const link = document.createElement('a');
                      link.download = `${stationName}_forecast_analysis.png`;
                      link.href = canvas.toDataURL();
                      link.click();
                      return;
                    }
                    
                    // GeoSFM: Professional vertical stacked layout (depth and streamflow)
                    if ((chartType === "riverdepth" || chartType === "streamflow") && geoFSMTimeSeriesData && geoFSMTimeSeriesData.length > 0) {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      
                      canvas.width = 1000;
                      canvas.height = 900;
                      
                      // Fill background
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      
                      const stationName = selectedStation?.properties?.Name || selectedStation?.properties?.Descriptio || 'GeoSFM Station';
                      
                      // Header section with centered branding
                      ctx.fillStyle = '#1B6840';
                      ctx.font = 'bold 24px Arial';
                      ctx.textAlign = 'center';
                      ctx.fillText('IGAD-ICPAC East Africa Flood Watch', canvas.width / 2, 30);
                      
                      // Station title
                      ctx.font = 'bold 18px Arial';
                      ctx.fillText(`${stationName} - GeoSFM Monitoring Data`, canvas.width / 2, 60);
                      
                      // Generation date
                      ctx.fillStyle = '#666';
                      ctx.font = '12px Arial';
                      ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}`, canvas.width / 2, 80);
                      
                      ctx.textAlign = 'left';
                      
                      // Chart dimensions
                      const chartWidth = 900;
                      const chartHeight = 320;
                      const margin = { top: 60, right: 120, bottom: 80, left: 80 };
                      
                      // Helper function to draw professional GeoSFM chart with legend
                      const drawProfessionalGeoSFMChart = (x, y, dataKey, color, title, unit) => {
                        // Plot area
                        const plotX = x + margin.left;
                        const plotY = y + margin.top;
                        const plotWidth = chartWidth - margin.left - margin.right;
                        const plotHeight = chartHeight - margin.top - margin.bottom;
                        
                        // Title
                        ctx.fillStyle = '#333';
                        ctx.font = 'bold 16px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${title} (${unit})`, x + chartWidth / 2, y + 25);
                        ctx.textAlign = 'left';
                        
                        // Get data values
                        const values = geoFSMTimeSeriesData.map(d => d[dataKey] || 0);
                        const maxValue = Math.max(...values);
                        const yScale = plotHeight / (maxValue * 1.1);
                        const xScale = plotWidth / (geoFSMTimeSeriesData.length - 1);
                        
                        // Grid lines
                        ctx.strokeStyle = '#f0f0f0';
                        ctx.lineWidth = 1;
                        for (let i = 0; i <= 6; i++) {
                          const gridY = plotY + plotHeight - (i * plotHeight / 6);
                          ctx.beginPath();
                          ctx.moveTo(plotX, gridY);
                          ctx.lineTo(plotX + plotWidth, gridY);
                          ctx.stroke();
                        }
                        
                        // Y-axis
                        ctx.strokeStyle = '#333';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(plotX, plotY);
                        ctx.lineTo(plotX, plotY + plotHeight);
                        ctx.stroke();
                        
                        // X-axis
                        ctx.beginPath();
                        ctx.moveTo(plotX, plotY + plotHeight);
                        ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
                        ctx.stroke();
                        
                        // Y-axis labels
                        ctx.fillStyle = '#666';
                        ctx.font = '11px Arial';
                        ctx.textAlign = 'right';
                        for (let i = 0; i <= 6; i++) {
                          const value = (maxValue * i) / 6;
                          const labelY = plotY + plotHeight - (i * plotHeight / 6);
                          ctx.fillText(value.toFixed(1), plotX - 10, labelY + 4);
                        }
                        
                        // Y-axis title
                        ctx.save();
                        ctx.translate(plotX - 50, plotY + plotHeight / 2);
                        ctx.rotate(-Math.PI / 2);
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${title} (${unit})`, 0, 0);
                        ctx.restore();
                        
                        // X-axis labels (dates)
                        ctx.textAlign = 'center';
                        ctx.font = '10px Arial';
                        ctx.fillStyle = '#666';
                        geoFSMTimeSeriesData.forEach((point, i) => {
                          if (i % Math.ceil(geoFSMTimeSeriesData.length / 10) === 0) {
                            const labelX = plotX + (i * xScale);
                            const date = new Date(point.timestamp);
                            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                            ctx.fillText(dateStr, labelX, plotY + plotHeight + 15);
                          }
                        });
                        
                        // X-axis title
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#333';
                        ctx.fillText('Date', plotX + plotWidth / 2, plotY + plotHeight + 40);
                        
                        // Draw line
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        
                        geoFSMTimeSeriesData.forEach((point, i) => {
                          const pointX = plotX + (i * xScale);
                          const pointY = plotY + plotHeight - ((point[dataKey] || 0) * yScale);
                          
                          if (i === 0) ctx.moveTo(pointX, pointY);
                          else ctx.lineTo(pointX, pointY);
                        });
                        ctx.stroke();
                        
                        // Draw points
                        ctx.fillStyle = color;
                        geoFSMTimeSeriesData.forEach((point, i) => {
                          const pointX = plotX + (i * xScale);
                          const pointY = plotY + plotHeight - ((point[dataKey] || 0) * yScale);
                          ctx.beginPath();
                          ctx.arc(pointX, pointY, 3, 0, 2 * Math.PI);
                          ctx.fill();
                        });
                        
                        // Legend box
                        const legendX = plotX + plotWidth - 150;
                        const legendY = plotY + 20;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(legendX, legendY, 130, 30);
                        ctx.strokeStyle = '#ddd';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(legendX, legendY, 130, 30);
                        
                        // Legend line
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(legendX + 10, legendY + 15);
                        ctx.lineTo(legendX + 30, legendY + 15);
                        ctx.stroke();
                        
                        // Legend text
                        ctx.fillStyle = '#333';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'left';
                        ctx.fillText(title, legendX + 35, legendY + 19);
                        
                        ctx.textAlign = 'left';
                      };
                      
                      // Draw charts vertically stacked
                      drawProfessionalGeoSFMChart(50, 120, 'depth', '#2196F3', 'River Depth', 'm');
                      drawProfessionalGeoSFMChart(50, 480, 'streamflow', '#FF6B35', 'Streamflow', 'm³/s');
                      
                      const link = document.createElement('a');
                      link.download = `${stationName}_geosfm_analysis.png`;
                      link.href = canvas.toDataURL();
                      link.click();
                      return;
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  📸 PNG
                </button>
                
                <button
                  className="close-button"
                  onClick={() => {
                    setShowChart(false);
                    setSelectedStation(null);
                    setTimeSeriesData([]);
                    setGeoFSMTimeSeriesData([]);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="chart-container" style={{ 
              height: `${Math.max(panelHeight - 45, 155)}px`, 
              width: '100%', 
              padding: '0 20px 10px 20px',
              overflow: 'hidden'
            }}>
              {chartType === "riverdepth" || chartType === "streamflow" ? (
                <GeoSFMChart
                  timeSeriesData={geoFSMTimeSeriesData}
                  dataType={geoFSMDataType}
                  stationName={selectedStation?.properties?.Name || selectedStation?.properties?.Descriptio || 'GeoSFM Station'}
                  height={Math.max(panelHeight - 65, 135)}
                />
              ) : (
                <div>
                  <div className="chart-controls mb-2" style={{ marginBottom: '10px' }}>
                    <select
                      value={selectedSeries}
                      onChange={(e) => setSelectedSeries(e.target.value)}
                      className="chart-select"
                      style={{ 
                        fontSize: '14px', 
                        padding: '6px 12px',
                        border: '2px solid #2196F3',
                        borderRadius: '4px',
                        backgroundColor: '#E3F2FD',
                        color: '#2196F3',
                        fontWeight: '500',
                        minWidth: '140px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#BBDEFB';
                        e.target.style.borderColor = '#1565C0';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#E3F2FD';
                        e.target.style.borderColor = '#2196F3';
                      }}
                    >
                      <option value="both">Both GFS & ICON</option>
                      <option value="gfs">GFS Only</option>
                      <option value="icon">ICON Only</option>
                    </select>
                  </div>
                  {timeSeriesData && timeSeriesData.length > 0 ? (
                    <DischargeChart
                      timeSeriesData={timeSeriesData}
                      selectedSeries={selectedSeries}
                      stationName={selectedStation?.properties?.SEC_NAME || 'FloodProofs Station'}
                      height={Math.max(panelHeight - 105, 115)}
                    />
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <p>Loading chart data... ({timeSeriesData?.length || 0} data points)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Metadata Modal */}
      <MetadataModal
        show={showMetadataModal}
        handleClose={handleCloseMetadata}
        metadata={currentMetadata}
      />
    </div>
  );
};

export default MapViewer;