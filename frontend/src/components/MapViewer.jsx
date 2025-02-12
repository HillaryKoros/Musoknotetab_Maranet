import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, LayersControl, GeoJSON, Popup } from 'react-leaflet';
import { Form, ListGroup, Nav, Tab } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import L from 'leaflet';

/********************************************************************************
 * MAP CONFIGURATION
 *******************************************************************************/
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://10.10.1.13:8093/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
};

const MONITORING_STATIONS_CONFIG = {
  name: 'Monitoring Stations',
  style: {
    radius: 8,
    fillColor: "#3388ff",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
    selectedFillColor: "#ff4444"
  }
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

// Function to get formatted date string for flood hazard layer
const getFloodHazardDate = () => {
  const today = new Date();
  let targetDate = today;

  // If needed, fall back to yesterday
  try {
    // Attempt to verify if today's layer exists
    // If not, use yesterday's date
    targetDate = today;
  } catch {
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - 1);
  }

  // Format date as YYYYMMDD
  return targetDate.toISOString().slice(0, 10).replace(/-/g, '');
};

// Create hazard layers with dynamic date
const HAZARD_LAYERS = [
  createWMSLayer('Inundation Map', `flood_hazard_${getFloodHazardDate()}`),
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
  // createWMSLayer('SectorData', 'Impact_sectordata')
];

const BOUNDARY_LAYERS = [
  createWMSLayer('Admin 1', 'gha_admin1'),
  createWMSLayer('Admin 2', 'gha_admin2'),
  createWMSLayer('Protected Areas', 'protected_areas')
];

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
 * LAYER SELECTOR COMPONENT
 *******************************************************************************/
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
            <label htmlFor={`layer-${layer.name}`} className="toggle-slider-small"></label>
          </div>
          <label htmlFor={`layer-${layer.name}`} className="layer-label">{layer.name}</label>
        </ListGroup.Item>
      ))}
    </ListGroup>
  </div>
);

/********************************************************************************
 * STATION INFO COMPONENT
 *******************************************************************************/
const StationInfo = ({ feature }) => {
  if (!feature?.properties) return null;
  const props = feature.properties;

  return (
    <div className="station-info-overlay">
      <h5>{props.SEC_NAME}</h5>
      <div className="station-details">
        <div><strong>Basin:</strong> {props.BASIN}</div>
        <div><strong>Area:</strong> {`${props.AREA} km²`}</div>
        <div><strong>Location:</strong> {`${props.latitude?.toFixed(4)}°N, ${props.longitude?.toFixed(4)}°E`}</div>
        <div><strong>Alert:</strong> {props.Q_THR1} m³/s</div>
        <div><strong>Alarm:</strong> {props.Q_THR2} m³/s</div>
        <div><strong>Emergency:</strong> {props.Q_THR3} m³/s</div>
      </div>
    </div>
  );
};

/********************************************************************************
 * DISCHARGE CHART COMPONENT
 *******************************************************************************/
const DischargeChart = ({ timeSeriesData }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return <div className="chart-no-data">No data available for the selected station.</div>;
  }

  const processedData = timeSeriesData.map(item => ({
    time: new Date(item.time),
    gfs: Number(item.gfs),
    icon: Number(item.icon)
  })).filter(item => !isNaN(item.gfs) && !isNaN(item.icon));

  return (
    <div className="chart-container">
      <ResponsiveContainer>
        <LineChart
          data={processedData}
          margin={{ top: 20, right: 30, left: 70, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={100}
            interval="preserveStartEnd" // Keeps consistent spacing
            tick={{ fontSize: 12 }}
            tickFormatter={(dt) =>
              dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) // DD, MM, YYYY
            }
            minTickGap={50} // Ensures labels don't overlap
          />
          <YAxis
            domain={['auto', 'auto']}
            tickCount={5}
            tickFormatter={(value) => value} // No unit on ticks
            label={{
              value: 'Discharge (m³/s)',
              angle: -90,
              position: 'insideLeft',
              offset: -30
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd'
            }}
            labelFormatter={(label) => `Date: ${label.toLocaleDateString('en-GB')}`}
            formatter={(value, name) => [`${value}`, `${name}`]}
          />
          <RechartsLegend />
          <Line
            type="monotone"
            dataKey="gfs"
            stroke="#1f77b4"
            name="GFS Forecast"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="icon"
            stroke="#ff7f0e"
            name="ICON Forecast"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};


/********************************************************************************
 * MAP LEGEND COMPONENT
 *******************************************************************************/
const ALERT_LEGEND = {
  title: 'Alerts Map',
  items: [
    { color: '#FF0000', label: 'Emergency Alert' },
    { color: '#FFFF00', label: 'Warning Alert' },
    { color: '#45cbf7', label: 'Watch Alert' },
  ]
};

const MapLegend = ({ legendUrl, title }) => {
  // Function to check if layer needs custom legend
  const needsCustomLegend = () => {
    return title === 'Alerts Map' || legendUrl.includes('floodwatch:Alerts');
  };

  // If it's an Alerts layer, use custom legend
  if (needsCustomLegend()) {
    return (
      <div className="map-legend">
        <h5>{ALERT_LEGEND.title}</h5>
        <div className="legend-items">
          {ALERT_LEGEND.items.map((item, index) => (
            <div key={index} className="legend-item" style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{ 
                width: '24px',
                height: '24px',
                backgroundColor: item.color,
                marginRight: '8px',
                border: '1px solid #ccc'
              }} />
              <span style={{ fontSize: '12px' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default legend for other layers
  return (
    <div className="map-legend">
      <h5>{title}</h5>
      <img 
        src={legendUrl} 
        alt={`Legend for ${title}`} 
        onError={(e) => e.target.style.display = 'none'} 
      />
    </div>
  );
};

/********************************************************************************
 * TABBED SIDEBAR COMPONENT
 *******************************************************************************/
const TabSidebar = ({ 
  hazardLayers, 
  impactLayers, 
  boundaryLayers, 
  selectedLayers, 
  onLayerSelect,
  showMonitoringStations,
  setShowMonitoringStations,
  selectedStation
}) => {
  return (
    <div className="tabbed-sidebar">
      <Tab.Container defaultActiveKey="monitoring">
        <Nav variant="tabs" className="sidebar-tabs">
          <Nav.Item>
            <Nav.Link eventKey="monitoring" className="tab-link">Monitoring Layers</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="forecast" className="tab-link">Forecast Layers</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
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
            <LayerSelector 
              title="Boundary Layers" 
              layers={boundaryLayers} 
              selectedLayers={selectedLayers} 
              onLayerSelect={onLayerSelect} 
            />
          </Tab.Pane>
          <Tab.Pane eventKey="forecast" className="tab-pane">
            <div className="forecast-content">
              <h4>Forecast River Discharge</h4>
              <ListGroup className="mb-4">
                <ListGroup.Item>
                  <div className="toggle-switch-small">
                    <input
                      type="checkbox"
                      id="monitoring-stations-toggle"
                      checked={showMonitoringStations}
                      onChange={() => setShowMonitoringStations(prev => !prev)}
                    />
                    <label htmlFor="monitoring-stations-toggle" className="toggle-slider-small"></label>
                  </div>
                  <label htmlFor="monitoring-stations-toggle">Monitoring Stations</label>
                </ListGroup.Item>
              </ListGroup>

              {selectedStation && (
                <div className="station-characteristics">
                  <h5>{selectedStation.properties?.SEC_NAME}</h5>
                  <div className="characteristics-grid">
                    <div className="characteristic-item">
                      <span className="characteristic-label">Basin:</span>
                      <span className="characteristic-value">{selectedStation.properties?.BASIN}</span>
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
                        {selectedStation.properties?.latitude?.toFixed(4)}°N, {selectedStation.properties?.longitude?.toFixed(4)}°E
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
                      <span className="characteristic-label">Emergency Threshold:</span>
                      <span className="characteristic-value emergency-threshold">
                        {selectedStation.properties?.Q_THR3} m³/s
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

/********************************************************************************
 * FEATURE INFO HANDLER COMPONENT
 *******************************************************************************/
const FeatureInfoHandler = ({ map, selectedLayers, onFeatureInfo }) => {
  useMapEvents({
    click: async (e) => {
      if (!map || selectedLayers.size === 0) return;

      const point = map.latLngToContainerPoint(e.latlng);
      const size = map.getSize();
      const bounds = map.getBounds();
      
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetFeatureInfo',
        QUERY_LAYERS: Array.from(selectedLayers).join(','),
        LAYERS: Array.from(selectedLayers).join(','),
        INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
        X: Math.round(point.x),
        Y: Math.round(point.y),
        WIDTH: size.x,
        HEIGHT: size.y,
        BBOX: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
        SRS: 'EPSG:4326',
        FEATURE_COUNT: 10
      });

      try {
        const response = await fetch(`${MAP_CONFIG.geoserverWMSUrl}?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          onFeatureInfo(data.features.map(feature => ({
            feature,
            position: e.latlng
          })));
        }
      } catch (error) {
        console.error('Error fetching feature info:', error);
      }
    }
  });

  return null;
};

/********************************************************************************
 * MAPVIEWER COMPONENT
 *******************************************************************************/
const MapViewer = () => {
  const [map, setMap] = useState(null);
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [activeLegend, setActiveLegend] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [showMonitoringStations, setShowMonitoringStations] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [showChart, setShowChart] = useState(false);
  const [featurePopups, setFeaturePopups] = useState([]);

  // Load monitoring stations data
  useEffect(() => {
    if (showMonitoringStations) {
      fetch('merged_data.geojson')
        .then(response => response.json())
        .then(data => {
          data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            feature.properties.latitude = coords[1];
            feature.properties.longitude = coords[0];
          });
          setMonitoringData(data);
        })
        .catch(error => console.error('Error loading monitoring data:', error));
    }
  }, [showMonitoringStations]);

  // Handle layer selection
  const handleLayerSelection = useCallback((layer) => {
    setSelectedLayers(prev => {
      const newSelectedLayers = new Set(prev);
      const isImpactLayer = IMPACT_LAYERS.some(l => l.layer === layer.layer);
      const isSectorData = layer.layer === 'floodwatch:Impact_sectordata';
  
      // If layer is being unchecked/removed
      if (newSelectedLayers.has(layer.layer)) {
        newSelectedLayers.delete(layer.layer);
        // Immediately remove the legend if it belongs to this layer
        if (activeLegend === layer.legend) {
          setActiveLegend(null);
        }
      } else {
        // Layer is being added
        if (isImpactLayer) {
          // Clear other impact layers except sector data
          IMPACT_LAYERS.forEach(l => {
            if (l.layer !== 'floodwatch:Impact_sectordata') {
              newSelectedLayers.delete(l.layer);
            }
          });
          if (!isSectorData) {
            newSelectedLayers.add(layer.layer);
          }
        }
        newSelectedLayers.add(layer.layer);
        setActiveLegend(layer.legend);
      }
      return newSelectedLayers;
    });
  }, [activeLegend]);

  // Handle station click
  const handleStationClick = useCallback((feature) => {
    setSelectedStation(feature);
    setShowChart(true);

    if (feature?.properties) {
      try {
        const timePeriod = feature.properties.time_period?.split(',') || [];
        const gfsValues = feature.properties['time_series_discharge_simulated-gfs']?.split(',').map(Number) || [];
        const iconValues = feature.properties['time_series_discharge_simulated-icon']?.split(',').map(Number) || [];

        const data = timePeriod.map((time, index) => ({
          time: time.trim(),
          gfs: gfsValues[index],
          icon: iconValues[index]
        })).filter(item => !isNaN(item.gfs) && !isNaN(item.icon));

        setTimeSeriesData(data);
      } catch (error) {
        console.error('Error processing time series data:', error);
        setTimeSeriesData([]);
      }
    }
  }, []);

  // Handle feature info response
  const handleFeatureInfo = useCallback((features) => {
    setFeaturePopups(features);
  }, []);

  return (
    <div className="map-viewer">
      <div className="sidebar">
        <TabSidebar
          hazardLayers={HAZARD_LAYERS}
          impactLayers={IMPACT_LAYERS}
          boundaryLayers={BOUNDARY_LAYERS}
          selectedLayers={selectedLayers}
          onLayerSelect={handleLayerSelection}
          showMonitoringStations={showMonitoringStations}
          setShowMonitoringStations={setShowMonitoringStations}
          selectedStation={selectedStation}
        />
      </div>

      <div className="main-content">
        <div className="map-container">
          <MapContainer
            center={MAP_CONFIG.initialPosition}
            zoom={MAP_CONFIG.initialZoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            whenCreated={setMap}
          >
            <LayersControl position="topright">
              {/* Base maps */}
              {BASE_MAPS.map((basemap) => (
                <LayersControl.BaseLayer 
                  key={basemap.name} 
                  name={basemap.name} 
                  checked={basemap.name === 'ICPAC'}
                >
                  <TileLayer url={basemap.url} attribution={basemap.attribution} />
                </LayersControl.BaseLayer>
              ))}

              {/* WMS layers */}
              {Array.from(selectedLayers).map((layer) => (
                <LayersControl.Overlay 
                  key={`${layer}-${mapKey}`} 
                  checked={true} 
                  name={layer.split(':')[1] || 'Layer'}
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

              {/* Monitoring stations */}
              {showMonitoringStations && monitoringData && (
                <GeoJSON
                  data={monitoringData}
                  pointToLayer={(feature, latlng) => 
                    L.circleMarker(latlng, {
                      ...MONITORING_STATIONS_CONFIG.style,
                      fillColor: selectedStation?.properties?.SEC_NAME === feature.properties.SEC_NAME 
                        ? MONITORING_STATIONS_CONFIG.style.selectedFillColor 
                        : MONITORING_STATIONS_CONFIG.style.fillColor
                    })
                  }
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      click: () => handleStationClick(feature)
                    });
                  }}
                />
              )}
            </LayersControl>

            <FeatureInfoHandler
              map={map}
              selectedLayers={selectedLayers}
              onFeatureInfo={handleFeatureInfo}
            />

            {/* Feature popups */}
            {featurePopups.map((popup, index) => (
              <Popup
                key={`popup-${index}`}
                position={[popup.position.lat, popup.position.lng]}
              >
                <div className="feature-info">
                  {Object.entries(popup.feature.properties)
                    .filter(([key]) => !key.startsWith('_'))
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
              title={Array.from(selectedLayers)
                .find(layer => layer.legend === activeLegend)?.name || 'Legend'} 
            />
          )}
        </div>

        {/* Chart panel */}
        {showChart && (
          <div className="bottom-panel">
            <div className="chart-header">
              <h5>{selectedStation?.properties?.SEC_NAME || 'Discharge Forecast'}</h5>
              <button 
                className="close-button"
                onClick={() => {
                  setShowChart(false);
                  setSelectedStation(null);
                  setTimeSeriesData([]);
                }}
              >
                ×
              </button>
            </div>
            <DischargeChart timeSeriesData={timeSeriesData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewer;