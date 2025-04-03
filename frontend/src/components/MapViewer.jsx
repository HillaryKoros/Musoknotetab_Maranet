// frontend/src/components/MapViewer.jsx
import React, { useState, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  useMapEvents,
  LayersControl,
  GeoJSON,
  Popup,
} from "react-leaflet";
import { ListGroup, Nav, Tab } from "react-bootstrap";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import L from "leaflet";
import { DischargeChart, GeoSFMChart } from "../utils/chartUtils.jsx"; // Import from utils

// Configuration for the map's initial state and WMS server
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: `http://197.254.1.10:8093/geoserver/floodwatch/wms`,
  getFeatureInfoFormat: "application/json",
};

// Configuration for monitoring stations (fp_sections_igad points)
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

// Utility function to create WMS layer objects
const createWMSLayer = (name, layerId) => ({
  name,
  layer: `floodwatch:${layerId}`,
  legend: `${MAP_CONFIG.geoserverWMSUrl}?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&LAYER=floodwatch:${layerId}`,
});

// Utility function to generate a date string for flood hazard layers
const getFloodHazardDate = () =>
  new Date().toISOString().slice(0, 10).replace(/-/g, "");

// Layer definitions
const HAZARD_LAYERS = [
  createWMSLayer("Inundation Map", `flood_hazard_${getFloodHazardDate()}`),
  createWMSLayer("Alerts Map", "Alerts"),
];
const IMPACT_LAYERS = [
  createWMSLayer("Affected Population", "Impact_affectedpopulation"),
  createWMSLayer("Affected GDP", "Impact_impactedgdp"),
  createWMSLayer("Affected Crops", "Impact_affectedcrops"),
  createWMSLayer("Affected Roads", "Impact_affectedroads"),
  createWMSLayer("Displaced Population", "Impact_displacedpopulation"),
  createWMSLayer("Affected Livestock", "Impact_affectedlivestock"),
  createWMSLayer("Affected Grazing Land", "Impact_affectedgrazingland"),
];
const BOUNDARY_LAYERS = [
  createWMSLayer("Admin 1", "Impact_admin1"),
  createWMSLayer("Admin 2", "gha_admin2"),
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

// Component to render a layer selector with checkboxes
const LayerSelector = ({ title, layers, selectedLayers, onLayerSelect }) => (
  <div className="layers-section">
    <h6>{title}</h6>
    <ListGroup className="layer-selector">
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name}>
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
        </ListGroup.Item>
      ))}
    </ListGroup>
  </div>
);

// Component for the sidebar with tabs
const TabSidebar = ({
  hazardLayers,
  impactLayers,
  selectedLayers,
  onLayerSelect,
  showMonitoringStations,
  setShowMonitoringStations,
  showGeoFSM,
  setShowGeoFSM,
  selectedStation,
  selectedYear,
  setSelectedYear,
  availableYears,
}) => (
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
          <h4>Forecast River Discharge</h4>
          <ListGroup className="mb-4">
            <ListGroup.Item>
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
                fp_sections_igad
              </label>
            </ListGroup.Item>
            <ListGroup.Item>
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
              {showGeoFSM && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="form-select mt-2"
                  style={{ fontSize: "14px" }}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
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
          />
          <LayerSelector
            title="Impact Layers"
            layers={impactLayers}
            selectedLayers={selectedLayers}
            onLayerSelect={onLayerSelect}
          />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  </div>
);

// Component to handle WMS GetFeatureInfo requests on map click
const FeatureInfoHandler = ({ map, selectedLayers, onFeatureInfo }) => {
  useMapEvents({
    click: async (e) => {
      if (!map || selectedLayers.size === 0) return;
      const point = map.latLngToContainerPoint(e.latlng);
      const size = map.getSize();
      const bounds = map.getBounds();
      const layersArray = Array.from(selectedLayers);
      const params = new URLSearchParams({
        SERVICE: "WMS",
        VERSION: "1.1.1",
        REQUEST: "GetFeatureInfo",
        QUERY_LAYERS: layersArray.join(","),
        LAYERS: layersArray.join(","),
        INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
        X: Math.round(point.x),
        Y: Math.round(point.y),
        WIDTH: size.x,
        HEIGHT: size.y,
        BBOX: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
        SRS: "EPSG:4326",
        FEATURE_COUNT: 10,
      });

      try {
        const response = await fetch(`${MAP_CONFIG.geoserverWMSUrl}?${params}`);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data?.features?.length > 0) {
          onFeatureInfo(
            data.features.map((feature) => ({ feature, position: e.latlng })),
          );
        }
      } catch (error) {
        console.error("Error fetching feature info:", error);
      }
    },
  });
  return null;
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

// Main MapViewer component
const MapViewer = () => {
  const [map, setMap] = useState(null);
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [isSidebarActive, setIsSidebarActive] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarActive(!isSidebarActive);
  };
  
  

  const [selectedBoundaryLayers, setSelectedBoundaryLayers] = useState(
    new Set(),
  );
  const [activeLegend, setActiveLegend] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [showMonitoringStations, setShowMonitoringStations] = useState(false);
  const [showGeoFSM, setShowGeoFSM] = useState(false);
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

  useEffect(() => {
    if (showMonitoringStations) {
      fetch("merged_data.geojson") // Adjust path to match public directory
        .then((response) => response.json())
        .then((data) => {
          data.features.forEach((feature) => {
            if (feature.geometry?.coordinates) {
              feature.properties.latitude = feature.geometry.coordinates[1];
              feature.properties.longitude = feature.geometry.coordinates[0];
            }
          });
          setMonitoringData(data);
        })
        .catch((error) =>
          console.error("Error loading monitoring data:", error),
        );
    } else {
      setMonitoringData(null);
      setTimeSeriesData([]);
      setSelectedStation(null);
    }
  }, [showMonitoringStations]);

  useEffect(() => {
    if (showGeoFSM) {
      fetch("hydro_data_with_locations.geojson")
        .then((response) => response.json())
        .then((data) => {
          // Extract available years from the data
          const years = [
            ...new Set(
              data.features.map((f) =>
                new Date(f.properties.timestamp).getFullYear(),
              ),
            ),
          ].sort();
          setAvailableYears(years);
          setSelectedYear(years[0]?.toString() || "2023");

          // Filter data by selected year
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

  const handleLayerSelection = useCallback(
    (layer) => {
      setSelectedLayers((prev) => {
        const newSelectedLayers = new Set(prev);
        const isImpactLayer = IMPACT_LAYERS.some(
          (l) => l.layer === layer.layer,
        );
        if (newSelectedLayers.has(layer.layer)) {
          newSelectedLayers.delete(layer.layer);
          if (activeLegend === layer.legend) setActiveLegend(null);
        } else {
          if (isImpactLayer)
            IMPACT_LAYERS.forEach((l) => newSelectedLayers.delete(l.layer));
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

  const handleBoundaryLayerSelection = useCallback(
    (layer) => {
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

  return (
    <div className="map-viewer">
      <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
        {isSidebarActive ? '✕' : '☰'}
      </button>
      <div className={`sidebar ${isSidebarActive ? 'active' : ''}`}>
        <TabSidebar
          hazardLayers={HAZARD_LAYERS}
          impactLayers={IMPACT_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
          showMonitoringStations={showMonitoringStations}
          setShowMonitoringStations={setShowMonitoringStations}
          showGeoFSM={showGeoFSM}
          setShowGeoFSM={setShowGeoFSM}
          selectedStation={selectedStation}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableYears={availableYears}
        />
      </div>
      <div className="main-content">
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
            {Array.from(selectedLayers).map((layerId) => (
              <WMSTileLayer
                key={layerId}
                url={MAP_CONFIG.geoserverWMSUrl}
                layers={layerId}
                format="image/png"
                transparent={true}
                version="1.1.1"
              />
            ))}
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
                {BOUNDARY_LAYERS.map((layer) => (
                  <LayersControl.Overlay
                    key={layer.layer}
                    name={layer.name}
                    checked={selectedBoundaryLayers.has(layer.layer)}
                  >
                    <WMSTileLayer
                      url={MAP_CONFIG.geoserverWMSUrl}
                      layers={layer.layer}
                      format="image/png"
                      transparent={true}
                      version="1.1.1"
                      eventHandlers={{
                        add: () => handleBoundaryLayerSelection(layer),
                        remove: () => handleBoundaryLayerSelection(layer),
                      }}
                    />
                  </LayersControl.Overlay>
                ))}
                {Array.from(selectedLayers).map((layer) => (
                  <LayersControl.Overlay
                    key={`${layer}-${mapKey}`}
                    checked={true}
                    name={layer.split(":")[1] || "Layer"}
                  >
                    <WMSTileLayer
                      url={MAP_CONFIG.geoserverWMSUrl}
                      layers={layer}
                      format="image/png"
                      transparent={true}
                      version="1.1.1"
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
              selectedLayers={
                new Set([...selectedLayers, ...selectedBoundaryLayers])
              }
              onFeatureInfo={handleFeatureInfo}
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
                [...HAZARD_LAYERS, ...IMPACT_LAYERS, ...BOUNDARY_LAYERS].find(
                  (layer) => layer.legend === activeLegend,
                )?.name || "Legend"
              }
            />
          )}
        </div>
        {showChart && (
          <div className="bottom-panel">
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
    </div>
  );
};

export default MapViewer;
