import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, LayersControl, GeoJSON, Popup } from 'react-leaflet';
import { Form, ListGroup, Nav, Tab } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer, ReferenceLine } from 'recharts';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import L from 'leaflet';

/********************************************************************************
 * MAP CONFIGURATION
 *******************************************************************************/
const MAP_CONFIG = {
  initialPosition: [4.6818, 34.9911],
  initialZoom: 5,
  geoserverWMSUrl: "http://127.0.0.1:8093/geoserver/floodwatch/wms",
  getFeatureInfoFormat: 'application/json',
  popupWidth: 300,
  popupMaxHeight: 400,
  popupOffset: [0, -10]
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

const HAZARD_LAYERS = [
  createWMSLayer('Inundation Map', 'flood_hazard_20250208'),
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
  <div>
    <h4>{title}</h4>
    <ListGroup>
      {layers.map((layer) => (
        <ListGroup.Item key={layer.name}>
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

/********************************************************************************
 * STATION INFO COMPONENT
 *******************************************************************************/
const StationInfo = ({ feature }) => {
  if (!feature?.properties) return null;
  const props = feature.properties;

  return (
    <div>
      <h5>{props.SEC_NAME}</h5>
      <div>
        <div><strong>Basin:</strong> {props.BASIN}</div>
        <div><strong>Area:</strong> {`${props.AREA} km²`}</div>
        <div><strong>Location:</strong> {`${props.latitude?.toFixed(4)}°N, ${props.longitude?.toFixed(4)}°E`}</div>
      </div>
      <div>
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
const DischargeChart = ({ timeSeriesData, feature }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return <div className="chart-no-data">No data available for the selected station.</div>;
  }

  const alertThreshold = feature?.properties?.Q_THR1 || 0;
  const alarmThreshold = feature?.properties?.Q_THR2 || 0;
  const emergencyThreshold = feature?.properties?.Q_THR3 || 0;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={timeSeriesData}
          margin={{ top: 20, right: 30, left: 70, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#666' }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 10, fill: '#666' }}
            label={{ 
              value: 'Discharge (m³/s)', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#666' },
              offset: -55
            }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}
            formatter={(value) => [`${value.toFixed(2)} m³/s`]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <RechartsLegend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingBottom: 10 }}
          />
          
          {/* Reference lines removed */}

          <Line
            type="monotone"
            dataKey="gfs"
            stroke="#4169E1"
            name="GFS Forecast"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="icon"
            stroke="#32CD32"
            name="ICON Forecast"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/********************************************************************************
 * MAP LEGEND COMPONENT
 *******************************************************************************/
const MapLegend = ({ legendUrl, title }) => (
  <div>
    <h5>{title}</h5>
    <img src={legendUrl} alt="Legend" onError={(e) => e.target.style.display = 'none'} />
  </div>
);
/********************************************************************************
 * LAYER POPUP COMPONENT
 *******************************************************************************/
const LayerPopup = ({ feature, position }) => {
  if (!feature?.properties) return null;

  return (
    <Popup position={position}>
      <div>
        {Object.entries(feature.properties)
          .filter(([key]) => !key.startsWith('_'))
          .map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
      </div>
    </Popup>
  );
};

/********************************************************************************
 * MAP INTERACTION HANDLER
 *******************************************************************************/
const MapInteractionHandler = ({ selectedLayers, onFeatureInfo }) => {
  const map = useMapEvents({
    click: async (e) => {
      if (!selectedLayers.size) return;

      const { lat, lng } = e.latlng;
      const bounds = map.getBounds();
      const size = map.getSize();
      const point = map.latLngToContainerPoint(e.latlng);

      try {
        const params = new URLSearchParams({
          REQUEST: 'GetFeatureInfo',
          SERVICE: 'WMS',
          VERSION: '1.1.1',
          LAYERS: Array.from(selectedLayers).join(','),
          QUERY_LAYERS: Array.from(selectedLayers).join(','),
          INFO_FORMAT: MAP_CONFIG.getFeatureInfoFormat,
          FEATURE_COUNT: '10',
          X: Math.round(point.x).toString(),
          Y: Math.round(point.y).toString(),
          BUFFER: '8',
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
          onFeatureInfo({
            features: data.features,
            latlng: { lat, lng }
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
            <Nav.Link eventKey="monitoring" className="tab-link">Monitoring Data</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="forecast" className="tab-link">Forecast Data</Nav.Link>
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
                  <Form.Check
                    type="checkbox"
                    id="monitoring-stations-toggle"
                    label="Monitoring Stations"
                    onChange={() => setShowMonitoringStations(prev => !prev)}
                    checked={showMonitoringStations}
                  />
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
 * MAPVIEWER COMPONENT
 *******************************************************************************/
const MapViewer = () => {
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [activeLegend, setActiveLegend] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [showMonitoringStations, setShowMonitoringStations] = useState(false);
  const [monitoringData, setMonitoringData] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [showChart, setShowChart] = useState(false);
  const [layerPopups, setLayerPopups] = useState([]);

  useEffect(() => {
    if (showMonitoringStations) {
      fetch('data/merged_data.geojson')
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

  const handleLayerSelection = useCallback((layer) => {
  setSelectedLayers(prev => {
    const newSelectedLayers = new Set(prev);
    if (newSelectedLayers.has(layer.layer)) {
      newSelectedLayers.delete(layer.layer);
    } else {
      newSelectedLayers.add(layer.layer);
    }
    return newSelectedLayers;
  });
  setActiveLegend(selectedLayers.has(layer.layer) ? null : layer.legend);
  setMapKey(prev => prev + 1);
}, [selectedLayers]);

  const handleStationClick = useCallback((feature) => {
    setSelectedStation(feature);
    setShowChart(true);

    if (feature?.properties) {
      const { time_period, 'time_series_discharge_simulated-gfs': gfs, 'time_series_discharge_simulated-icon': icon } = feature.properties;
      
      try {
        const times = time_period.split(',');
        const gfsValues = gfs.split(',').map(Number);
        const iconValues = icon.split(',').map(Number);
        
        const data = times.map((time, i) => ({
          time: time.split(' ')[0],
          gfs: gfsValues[i],
          icon: iconValues[i]
        }));
        
        setTimeSeriesData(data.filter((_, index) => index % 6 === 0));
      } catch (error) {
        console.error('Error parsing time series data:', error);
      }
    }
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
          >
            <LayersControl position="topright">
              {BASE_MAPS.map((basemap) => (
                <LayersControl.BaseLayer key={basemap.name} name={basemap.name} checked={basemap.name === 'ICPAC'}>
                  <TileLayer url={basemap.url} attribution={basemap.attribution} />
                </LayersControl.BaseLayer>
              ))}

              {Array.from(selectedLayers).map((layer) => (
                <LayersControl.Overlay key={layer} checked={true} name={layer.split(':')[1] || 'Custom Layer'}>
                  <WMSTileLayer
                    key={`wms-${mapKey}-${layer}`}
                    url={MAP_CONFIG.geoserverWMSUrl}
                    layers={layer}
                    format="image/png"
                    transparent={true}
                    attribution="GeoServer"
                    version="1.1.1"
                  />
                </LayersControl.Overlay>
              ))}

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
          </MapContainer>

          {activeLegend && <MapLegend legendUrl={activeLegend} />}
        </div>

        {showChart && (
          <div className="bottom-panel">
            <div className="chart-header">
              <h5>{selectedStation?.properties?.SEC_NAME || 'Discharge Chart'}</h5>
              <button className="close-button" onClick={() => { setShowChart(false); setSelectedStation(null); }}>×</button>
            </div>
            <DischargeChart timeSeriesData={timeSeriesData} feature={selectedStation} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewer;