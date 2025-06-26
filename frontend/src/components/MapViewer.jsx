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
  createWMSLayer("Health Centers Affected", "healthtot_%date%", true, false, true),
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
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
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
                    padding: '4px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
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
  selectedStation,
  selectedYear,
  setSelectedYear,
  availableYears,
  showMikeHydro,
  setShowMikeHydro,
  showFastFlood,
  setShowFastFlood,
  showGlofas,
  setShowGlofas,
  onInfoClick,
  selectedDates,
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
                  {showGeoFSM && (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="form-select mt-2"
                      style={{ fontSize: "14px", marginLeft: "38px" }}
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
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
              selectedDate={selectedDates?.inundation}
              onDateChange={(date) => onDateChange('inundation', date)}
            />
            <LayerSelector
              title="Impact Layers"
              layers={impactLayers}
              selectedLayers={selectedLayers}
              onLayerSelect={onLayerSelect}
              onInfoClick={onInfoClick}
              selectedDate={selectedDates?.impact}
              onDateChange={(date) => onDateChange('impact', date)}
              showCalendar={true} // FIXED: Changed from false to true
            />
            <LayerSelector
              title="IBEW Layers"
              layers={ibewLayers}
              selectedLayers={selectedLayers}
              onLayerSelect={onLayerSelect}
              onInfoClick={onInfoClick}
              selectedDate={selectedDates?.ibew}
              onDateChange={(date) => onDateChange('ibew', date)}
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
  const [isSidebarActive, setIsSidebarActive] = useState(true);
  const [selectedBoundaryLayers, setSelectedBoundaryLayers] = useState(new Set([
    'rivers',
    'admin_level_1'
  ]));
  const [activeLegend, setActiveLegend] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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
  const [chartType, setChartType] = useState("discharge");
  const [geoFSMDataType, setGeoFSMDataType] = useState("riverdepth");
  const [selectedSeries, setSelectedSeries] = useState("both");
  const [selectedYear, setSelectedYear] = useState("2023");
  const [availableDataTypes, setAvailableDataTypes] = useState([]);
  const [availableYears, setAvailableYears] = useState(["2023"]);
  const [isLayerControlVisible, setIsLayerControlVisible] = useState(false);
  
  // State for metadata modal
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState(null);
  
  // State for selected dates for different layer types
  const [selectedDates, setSelectedDates] = useState({
    stations: new Date().toISOString().split('T')[0],
    inundation: new Date().toISOString().split('T')[0],
    impact: new Date().toISOString().split('T')[0],
    ibew: new Date().toISOString().split('T')[0],
  });

  // Handler for date changes
  const handleDateChange = (layerType, date) => {
    console.log(`Date changed for ${layerType}: ${date}`);
    setSelectedDates(prev => ({
      ...prev,
      [layerType]: date
    }));
    
    // Force map refresh for IBEW layers when date changes
    if (layerType === 'ibew') {
      setMapKey(prev => prev + 1);
    }
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
      fetch("hydro_data_with_locations.geojson")
        .then((response) => response.json())
        .then((data) => {
          const years = [
            ...new Set(
              data.features.map((f) =>
                new Date(f.properties.timestamp).getFullYear(),
              ),
            ),
          ].sort();
          setAvailableYears(years);
          setSelectedYear(years[0]?.toString() || "2023");

          const filteredData = {
            ...data,
            features: data.features.filter(
              (f) =>
                new Date(f.properties.timestamp).getFullYear().toString() ===
                selectedYear,
            ),
          };
          data.features.forEach((feature) => {
            if (feature.geometry?.coordinates) {
              feature.properties.latitude = feature.geometry.coordinates[1];
              feature.properties.longitude = feature.geometry.coordinates[0];
            }
          });
          setGeoFSMData(data);
          const validTypes = ["riverdepth", "streamflow"];
          const dataTypes = [
            ...new Set(
              data.features
                .map((f) => f.properties.data_type)
                .filter((type) => type && validTypes.includes(type)),
            ),
          ];
          setAvailableDataTypes(
            dataTypes.length > 0 ? dataTypes : ["riverdepth"],
          );
          setGeoFSMDataType(dataTypes[0] || "riverdepth");

          const allTimeSeries = data.features
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
        })
        .catch((error) => console.error("Error loading GeoSFM data:", error));
    } else {
      setGeoFSMData(null);
      setGeoFSMTimeSeriesData([]);
      setAvailableDataTypes([]);
      setSelectedStation(null);
    }
  }, [showGeoFSM]);

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

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
      setSelectedStation(feature);
      setShowChart(true);
      if (!feature?.properties) return;

      const dataType = feature.properties.data_type || "discharge";
      setChartType(dataType);
      setGeoFSMDataType(dataType === "discharge" ? "riverdepth" : dataType);

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
        } else {
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

          const data = timePeriod
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
          setTimeSeriesData(data);
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

  const toggleSidebar = () => setIsSidebarActive(!isSidebarActive);
  
  // Update hazard layers
  const hazardLayersWithDate = React.useMemo(() => [
    createWMSLayer("Inundation Map", `flood_hazard`, true, false, true),
    createWMSLayer("Alerts Map", "Alerts", true, false, false),
  ], []);

  // Get the appropriate date for a layer type
  const getDateForLayerType = (layerConfig) => {
    if (!layerConfig.needsDate) return null;
    
    // Determine which date to use based on layer
    if (IMPACT_LAYERS.some(l => l.layer === layerConfig.layer)) {
      return selectedDates.impact;
    } else if (IBEW_LAYERS.some(l => l.layer === layerConfig.layer)) {
      return selectedDates.ibew;
    } else if (layerConfig.layer.includes('flood_hazard')) {
      return selectedDates.inundation;
    }
    return null;
  };

  return (
    <div className={`map-viewer ${isMobile ? 'mobile-view' : ''}`}>
      {isMobile && (
        <button 
          className="toggle-sidebar-btn mobile-toggle" 
          onClick={toggleSidebar}
          aria-label={isSidebarActive ? "Close layers" : "Open layers"}
        >
          {isSidebarActive ? "×" : "☰"}
        </button>
      )}
      <div className={`sidebar ${isSidebarActive ? "active" : ""} ${isMobile ? 'mobile-sidebar' : ''}`}>
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
          selectedStation={selectedStation}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableYears={availableYears}
          showMikeHydro={showMikeHydro}
          setShowMikeHydro={setShowMikeHydro}
          showFastFlood={showFastFlood}
          setShowFastFlood={setShowFastFlood}
          showGlofas={showGlofas}
          setShowGlofas={setShowGlofas}
          onInfoClick={handleInfoClick}
          selectedDates={selectedDates}
          onDateChange={handleDateChange}
        />
      </div>
      <div className={`main-content ${isMobile ? 'mobile-content' : ''}`}>
        <div className="map-container">
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
                  zIndex={200}
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
            
            <div
              className="toggle-label"
              onClick={() => setIsLayerControlVisible(!isLayerControlVisible)}
            >
              Flood Watch
            </div>
            <div
              className={`layer-control-panel ${isLayerControlVisible ? "visible" : ""}`}
            >
              <button
                className="layer-control-close-btn"
                onClick={() => setIsLayerControlVisible(false)}
              >
                Close
              </button>
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
                          if (layer.layer !== 'admin_level_1') {
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
            </div>
            
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
              selectedDate={selectedDates?.ibew}
              mapConfig={MAP_CONFIG}
            />
            
          </MapContainer>
          {activeLegend && (
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
          )}
        </div>
        {showChart && (
          <div className={`bottom-panel ${isMobile && isSidebarActive ? 'with-sidebar' : ''}`}>
            <div className="chart-header">
              <h5>
                {selectedStation?.properties?.SEC_NAME ||
                  (chartType === "riverdepth"
                    ? "GeoSFM River Depth"
                    : chartType === "streamflow"
                      ? "GeoSFM Streamflow"
                      : "Discharge Forecast")}
              </h5>
              {(chartType === "riverdepth" || chartType === "streamflow") && (
                <div className="chart-controls">
                  {availableDataTypes.length > 1 && (
                    <select
                      value={geoFSMDataType}
                      onChange={(e) => {
                        setGeoFSMDataType(e.target.value);
                        setChartType(e.target.value);
                      }}
                      style={{ marginLeft: "10px" }}
                    >
                      {availableDataTypes.map((type) => (
                        <option key={type} value={type}>
                          {type === "riverdepth" ? "River Depth" : "Streamflow"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
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
            {chartType === "riverdepth" || chartType === "streamflow" ? (
              <GeoSFMChart
                timeSeriesData={geoFSMTimeSeriesData}
                dataType={geoFSMDataType}
              />
            ) : (
              <div>
                <div className="chart-controls mb-2">
                  <select
                    value={selectedSeries}
                    onChange={(e) => setSelectedSeries(e.target.value)}
                    className="chart-select"
                  >
                    <option value="both">Both GFS & ICON</option>
                    <option value="gfs">GFS Only</option>
                    <option value="icon">ICON Only</option>
                  </select>
                </div>
                <DischargeChart
                  timeSeriesData={timeSeriesData}
                  selectedSeries={selectedSeries}
                />
              </div>
            )}
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