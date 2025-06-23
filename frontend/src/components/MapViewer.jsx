import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  useMapEvents,
  LayersControl,
  GeoJSON,
  Popup,
} from "react-leaflet";
import { ListGroup, Nav, Tab, Modal, Button } from "react-bootstrap";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import L from "leaflet";
import { DischargeChart, GeoSFMChart } from "../utils/chartUtils.jsx";

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

// Metadata for layers
const LAYER_METADATA = {
  'FloodProofs East Africa': {
    description: 'FloodProof East Africa provides near real-time flood monitoring and early warning systems for East African countries.',
    details: [
      'Integrates satellite data with ground observations for accurate flood detection.',
      'Provides historical flood data and predictive modeling for flood-prone areas.'
    ],
    source: 'ICPAC Flood Monitoring System'
  },
  'GeoSFM': {
    description: 'GeoSFM (Geospatial Stream Flow Model) is a hydrological modeling system used for flood forecasting.',
    details: [
      'Uses satellite precipitation data to predict river flow and flooding.',
      'Provides early warning of potential flooding events.'
    ],
    source: 'USGS and NASA Earth Observation Systems'
  },
  'Mike Hydro': {
    description: 'Mike Hydro provides comprehensive hydrological modeling for water resource management.',
    details: [
      'Simulates river dynamics, flooding, and water quality.',
      'Supports watershed management and flood mitigation planning.'
    ],
    source: 'DHI Group'
  },
  'Fast Flood': {
    description: 'Fast Flood delivers rapid flood detection and monitoring using satellite imagery.',
    details: [
      'Provides near real-time flood extent mapping.',
      'Uses synthetic aperture radar for cloud-penetrating observations.'
    ],
    source: 'Regional Remote Sensing Center'
  },
  'Glofas': {
    description: 'Glofas (Global Flood Awareness System) provides global flood forecasting and monitoring.',
    details: [
      'Offers medium-range flood forecasts up to 30 days in advance.',
      'Provides probabilistic flood predictions.'
    ],
    source: 'European Commission Joint Research Centre'
  },
  'Inundation Map': {
    description: 'The Inundation Map shows areas currently under water due to flooding.',
    details: [
      'Based on satellite data updated daily.',
      'Shows water extent and depth information.'
    ],
    source: 'ICPAC Satellite Observation System'
  },
  'Alerts Map': {
    description: 'The Alerts Map shows areas with active flood warnings and alerts.',
    details: [
      'Displays different alert levels based on severity.',
      'Incorporates weather forecasts and hydrological data.',
      'Supports early warning and evacuation planning.'
    ],
    source: 'Regional Meteorological Services'
  },
  'Affected Population': {
    description: 'Displays an estimate of population impacted by current or predicted flooding.',
    details: [
      'Based on population density data overlaid with flood extents.',
      'Provides estimates at different administrative levels.',
      'Helps prioritize humanitarian response.',
      'Updated as flood conditions change.'
    ],
    source: 'ICPAC Impact Analysis'
  },
  'Affected GDP': {
    description: 'Shows economic impact of flooding in terms of GDP affected.',
    details: [
      'Combines flood extent with economic activity data.',
      'Helps quantify economic losses.',
      'Supports disaster recovery planning.',
      'Useful for long-term resilience planning.'
    ],
    source: 'Economic Impact Assessment Unit'
  },
  'Affected Crops': {
    description: 'Displays agricultural areas impacted by flooding.',
    details: [
      'Combines flood data with crop distribution maps.',
      'Helps estimate agricultural losses.',
      'Supports food security planning.',
      'Identifies areas for agricultural assistance.'
    ],
    source: 'Agricultural Monitoring System'
  },
  'Affected Roads': {
    description: 'Shows roads and transportation infrastructure impacted by flooding.',
    details: [
      'Highlights impassable road sections.',
      'Supports logistics and supply chain planning.',
      'Helps identify isolated communities.',
      'Updated regularly based on field reports and satellite data.'
    ],
    source: 'Infrastructure Monitoring System'
  },
  'Displaced Population': {
    description: 'Estimates of people displaced from their homes due to flooding.',
    details: [
      'Shows likely displacement patterns based on flood severity.',
      'Helps plan shelter and humanitarian assistance.',
      'Indicates pressure points for emergency services.',
      'Based on historical displacement patterns and current conditions.'
    ],
    source: 'Displacement Tracking Matrix'
  },
  'Affected Livestock': {
    description: 'Shows livestock populations at risk from flooding.',
    details: [
      'Based on livestock distribution data and flood extents.',
      'Helps plan veterinary services and feed distribution.',
      'Supports pastoralist community assistance.',
      'Identifies areas for livestock evacuation.'
    ],
    source: 'Livestock Information System'
  },
  'Affected Grazing Land': {
    description: 'Displays grazing areas impacted by flooding.',
    details: [
      'Shows pasture and rangeland under water.',
      'Helps forecast potential livestock movements.',
      'Supports planning for alternative grazing arrangements.',
      'Identifies areas for feed distribution.'
    ],
    source: 'Rangeland Monitoring System'
  },
  'Lakes': {
    description: 'Display of major lakes and water bodies in the region.',
    details: [
      'Shows natural and artificial lakes.',
      'Helps understand water distribution and flood patterns.',
      'Important reference for flood impact analysis.'
    ],
    source: 'Regional Water Resources Department'
  },
  'Rivers': {
    description: 'Network of major rivers and tributaries in the region.',
    details: [
      'Shows main watercourses and drainage patterns.',
      'Critical for understanding flood pathways.',
      'Helps predict areas at risk of flooding.'
    ],
    source: 'Regional Hydrological Database'
  },
  'Basins': {
    description: 'Watershed basins showing major drainage regions.',
    details: [
      'Depicts hydrological catchment areas.',
      'Important for watershed management.',
      'Helps understand flood propagation across regions.'
    ],
    source: 'Regional Water Resources Management'
  },
  'Admin 1': {
    description: 'Administrative boundaries at the first level.',
    details: [
      'Shows primary administrative divisions.',
      'Used for regional planning and coordination.',
      'Helps organize disaster response efforts.'
    ],
    source: 'National Geographic Information Systems'
  },
  'Admin 2': {
    description: 'Administrative boundaries at the second level.',
    details: [
      'Shows more detailed administrative subdivisions.',
      'Useful for local planning and targeted response.',
      'Enables more granular analysis of flood impacts.'
    ],
    source: 'National Geographic Information Systems'
  },
  // IBEW specific layer metadata
  'Health Centers Affected': {
    description: 'Shows health centers and medical facilities impacted by flooding.',
    details: [
      'Identifies health facilities at risk or already affected.',
      'Helps prioritize medical supply distribution.',
      'Supports continuity of healthcare services.',
      'Critical for emergency medical planning.'
    ],
    source: 'Health Infrastructure Monitoring System'
  },
  'People Affected (100cm)': {
    description: 'People affected by at least 100 cm of flood depth.',
    details: [
      'Shows areas with severe flooding exceeding 1 meter.',
      'Indicates zones requiring immediate evacuation.',
      'Helps prioritize rescue operations.',
      'Critical depth threshold for life-threatening conditions.'
    ],
    source: 'IBEW Flood Impact Analysis'
  },
  'People Affected (25cm)': {
    description: 'People affected by at least 25 cm of flood depth.',
    details: [
      'Shows areas with moderate flooding of 25cm or more.',
      'Indicates zones where movement is restricted.',
      'Helps plan for assistance and supply distribution.',
      'Early warning threshold for flood impacts.'
    ],
    source: 'IBEW Flood Impact Analysis'
  },
  'Total People Affected': {
    description: 'Total population affected by flooding regardless of depth.',
    details: [
      'Comprehensive count of all affected individuals.',
      'Includes direct and indirect flood impacts.',
      'Essential for humanitarian response planning.',
      'Updated based on real-time flood extents.'
    ],
    source: 'IBEW Population Impact Assessment'
  },
  'Vulnerable Age Groups (100cm)': {
    description: 'Vulnerable age groups affected by severe flooding (100cm+).',
    details: [
      'Focus on children under 5 and elderly over 65 years.',
      'Higher risk groups requiring priority assistance.',
      'Critical for targeted evacuation planning.',
      'Helps allocate specialized medical resources.'
    ],
    source: 'IBEW Vulnerability Assessment'
  },
  'Vulnerable Age Groups (25cm)': {
    description: 'Vulnerable age groups affected by moderate flooding (25cm+).',
    details: [
      'Children and elderly in areas with restricted movement.',
      'Early intervention threshold for vulnerable populations.',
      'Supports preventive evacuation measures.',
      'Helps plan age-appropriate assistance.'
    ],
    source: 'IBEW Vulnerability Assessment'
  },
  'Reduced Mobility (100cm)': {
    description: 'People with reduced mobility affected by severe flooding.',
    details: [
      'Individuals with disabilities in high-risk flood zones.',
      'Requires specialized evacuation equipment.',
      'Critical for inclusive disaster response.',
      'Highest priority for assisted evacuation.'
    ],
    source: 'IBEW Disability Inclusion Analysis'
  },
  'Reduced Mobility (25cm)': {
    description: 'People with reduced mobility affected by moderate flooding.',
    details: [
      'Early warning for disability-inclusive planning.',
      'Identifies areas needing accessible routes.',
      'Supports proactive assistance measures.',
      'Helps prevent isolation of disabled individuals.'
    ],
    source: 'IBEW Disability Inclusion Analysis'
  }
};

// Helper function to handle layer loading errors
const handleLayerError = (layerId, error) => {
  console.error(`Error loading layer ${layerId}:`, error);
};

// Utility function to create WMS layer objects with date support
const createWMSLayer = (name, layerId, isMapServer = false, useCache = true, needsDate = false) => {
  const wmsUrl = (useCache && isMapServer) ? MAP_CONFIG.mapcacheWMSUrl : MAP_CONFIG.mapserverWMSUrl;
  
  return {
    name,
    layer: layerId,
    legend: isMapServer 
      ? `${MAP_CONFIG.mapserverWMSUrl}&REQUEST=GetLegendGraphic&VERSION=1.1.0&FORMAT=image/png&LAYER=${layerId}&SLD_VERSION=1.1.0`
      : `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
    isMapServer,
    useCache,
    wmsUrl,
    needsDate // Flag to indicate if this layer needs date formatting
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
      return baseLayerId; // Impact layers don't use dates
    default:
      return baseLayerId;
  }
};

// Impact layers - no date support
const IMPACT_LAYERS = [
  createWMSLayer("Affected Population", "impact_population", true, true, false),
  createWMSLayer("Affected GDP", "impact_gdp", true, true, false),
  createWMSLayer("Affected Crops", "impact_crops", true, true, false),
  createWMSLayer("Affected Roads", "impact_roads", true, true, false),
  createWMSLayer("Displaced Population", "impact_displaced", true, true, false),
  createWMSLayer("Affected Livestock", "impact_livestock", true, true, false),
  createWMSLayer("Affected Grazing Land", "impact_grazing", true, true, false),
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

// Component to render map legends
const MapLegend = ({ legendUrl, title }) => {
  const needsCustomLegend = () =>
    title === "Hazard Map" ||
    legendUrl?.includes("floodwatch:Alerts") ||
    title === "GeoFSM" ||
    legendUrl?.includes("floodwatch:geofsm_layer");
    
  const legendData = needsCustomLegend()
    ? title === "GeoFSM" || legendUrl?.includes("floodwatch:geofsm_layer")
      ? {
          title: "GeoFSM",
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

  return needsCustomLegend() ? (
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
  ) : legendUrl ? (
    <div className="map-legend">
      <h5>{title}</h5>
      <img
        src={legendUrl}
        alt={`Legend for ${title}`}
        onError={(e) => (e.target.style.display = "none")}
      />
    </div>
  ) : null;
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

// UPDATED FeatureInfoHandler to filter IBEW layer results
const FeatureInfoHandler = ({ map, selectedLayers, selectedBoundaryLayers, onFeatureInfo, selectedDates }) => {
  useMapEvents({
    click: async (e) => {
      if (!map || (selectedLayers.size === 0 && selectedBoundaryLayers.size === 0)) return;
      
      const point = map.latLngToContainerPoint(e.latlng);
      const size = map.getSize();
      const bounds = map.getBounds();
      
      // Check if any IBEW layers are active
      const activeIBEWLayers = Array.from(selectedLayers).filter(layerId => 
        IBEW_LAYERS.some(ibewLayer => ibewLayer.layer === layerId)
      );
      
      // If IBEW layers are active, only query those layers
      const layersToQuery = activeIBEWLayers.length > 0 
        ? activeIBEWLayers 
        : [...Array.from(selectedLayers), ...Array.from(selectedBoundaryLayers)];
      
      if (layersToQuery.length > 0) {
        const params = new URLSearchParams({
          SERVICE: "WMS",
          VERSION: "1.1.0",
          REQUEST: "GetFeatureInfo",
          QUERY_LAYERS: layersToQuery.join(","),
          LAYERS: layersToQuery.join(","),
          INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
          X: Math.round(point.x),
          Y: Math.round(point.y),
          WIDTH: size.x,
          HEIGHT: size.y,
          BBOX: `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`,
          SRS: "EPSG:4326",
          FEATURE_COUNT: 10,
        });

        // Add date parameters for IBEW layers
        if (activeIBEWLayers.length > 0 && selectedDates?.ibew) {
          const formattedDate = selectedDates.ibew.replace(/-/g, '');
          params.set('date', formattedDate);
          params.set('datetime', `${formattedDate}0000`);
        }

        try {
          const response = await fetch(`${MAP_CONFIG.mapserverWMSUrl}&${params}`);
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          
          if (data?.features?.length > 0) {
            // Filter features to only show IBEW layer data if IBEW layers are active
            let filteredFeatures = data.features;
            
            if (activeIBEWLayers.length > 0) {
              // Only show features from IBEW layers
              filteredFeatures = data.features.filter(feature => {
                // Check if the feature belongs to an IBEW layer
                // This can be determined by the layer name in the feature properties
                const layerName = feature.properties?.layer_name || feature.layer;
                return activeIBEWLayers.some(ibewLayerId => {
                  // Remove the %date% placeholder for comparison
                  const baseLayerId = ibewLayerId.replace('_%date%', '');
                  return layerName?.includes(baseLayerId) || layerName === ibewLayerId;
                });
              });
            }
            
            if (filteredFeatures.length > 0) {
              onFeatureInfo(
                filteredFeatures.map((feature) => ({ feature, position: e.latlng }))
              );
            }
          }
        } catch (error) {
          console.error("Error fetching feature info from MapServer:", error);
        }
      }
    },
  });
  return null;
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
  const [map, setMap] = useState(null);
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
  const [featurePopups, setFeaturePopups] = useState([]);
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
    const metadata = LAYER_METADATA[layerName] || {
      title: layerName,
      description: `Metadata for ${layerName}`,
      details: ["Detailed information not available"],
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
      
      setFeaturePopups([]);
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

  const handleFeatureInfo = useCallback((features) => {
    if (features?.length) setFeaturePopups(features);
  }, []);

  useEffect(() => {
    setFeaturePopups([]);
  }, [selectedLayers, selectedBoundaryLayers]);

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
            whenCreated={setMap}
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
            <FeatureInfoHandler
              map={map}
              selectedLayers={selectedLayers}
              selectedBoundaryLayers={selectedBoundaryLayers}
              onFeatureInfo={handleFeatureInfo}
              selectedDates={selectedDates}
            />
            {featurePopups.map((popup, index) => (
              <Popup
                key={`popup-${index}-${popup.position.lat}-${popup.position.lng}`}
                position={[popup.position.lat, popup.position.lng]}
                onClose={() =>
                  setFeaturePopups((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                <div className="feature-info">
                  {popup.feature.properties &&
                    Object.entries(popup.feature.properties)
                      .filter(([key]) => !key.startsWith("_") && key !== "bbox")
                      .map(([key, value]) => (
                        <div key={key} className="popup-row">
                          <strong>{key}:</strong> {value}
                        </div>
                      ))}
                </div>
              </Popup>
            ))}
          </MapContainer>
          {activeLegend && (
            <MapLegend
              legendUrl={activeLegend}
              title={
                [...hazardLayersWithDate, ...IMPACT_LAYERS, ...IBEW_LAYERS, ...BOUNDARY_LAYERS].find(
                  (layer) => layer.legend === activeLegend,
                )?.name || "Legend"
              }
            />
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