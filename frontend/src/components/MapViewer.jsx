import React, { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMapEvents, LayersControl, GeoJSON, Popup } from 'react-leaflet';
import { ListGroup, Nav, Tab } from 'react-bootstrap';
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
  geoserverWMSUrl: `http://10.10.1.13:8093/geoserver/floodwatch/wms`,
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

const getFloodHazardDate = () => {
  const today = new Date();
  let targetDate = today;
  try {
    targetDate = today;
  } catch {
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - 1);
  }
  return targetDate.toISOString().slice(0, 10).replace(/-/g, '');
};

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
];

const BOUNDARY_LAYERS = [
  createWMSLayer('Admin 1', 'Impact_admin1'),
  createWMSLayer('Admin 2', 'gha_admin2')
];

const GEOFSM_LAYER = createWMSLayer('GeoFSM', 'geofsm_layer');

const BASE_MAPS = [
  {
    name: 'ICPAC',
    url: 'https://eahazardswatch.icpac.net/tileserver-gl/styles/droughtwatch/{z}/{x}/{y}.png',
    attribution: '© ICPAC_FloodWatch'
  },
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© ESRI, Maxar'
  },
  {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors'
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
          syncId="station-chart"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={100}
            interval="preserveStartEnd"
            tick={{ fontSize: 12 }}
            tickFormatter={(dt) =>
              dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            }
            minTickGap={50}
            tickSize={8}
            axisLine={true}
            tickLine={true}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickCount={5}
            tickFormatter={(value) => Number(value).toFixed(1)}
            label={{
              value: 'Discharge (m³/s)',
              angle: -90,
              position: 'insideLeft',
              offset: -50,
              style: {
                textAnchor: 'middle',
                fontSize: '12px',
                fontWeight: 'bold'
              }
            }}
            padding={{ left: 20 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd'
            }}
            labelFormatter={(label) => `Date: ${label.toLocaleDateString('en-GB')}`}
            formatter={(value, name) => [`${Number(value).toFixed(1)}`, `${name}`]}
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
 * GEOSFM CHART COMPONENT - Updated to show full data
 *******************************************************************************/
const GeoSFMChart = ({ timeSeriesData, dataType = 'riverdepth' }) => {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return <div className="chart-no-data">No data available for the selected GeoSFM point.</div>;
  }

  const yAxisLabel = dataType === 'riverdepth' ? 'River Depth (m)' : 'Streamflow (m³/s)';
  const tooltipLabel = dataType === 'riverdepth' ? 'River Depth' : 'Streamflow';
  const displayUnit = dataType === 'riverdepth' ? 'm' : 'm³/s';

  return (
    <div className="chart-container">
      <ResponsiveContainer>
        <LineChart
          data={timeSeriesData}
          margin={{ top: 20, right: 30, left: 70, bottom: 80 }}
          syncId="geosfm-chart"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} />
          <XAxis
            dataKey="timestamp"
            angle={-45}
            textAnchor="end"
            height={100}
            interval="preserveStartEnd"
            tick={{ fontSize: 12 }}
            tickFormatter={(dt) => new Date(dt).toLocaleDateString('en-GB')}
            minTickGap={50}
            tickSize={8}
            axisLine={true}
            tickLine={true}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickCount={5}
            tickFormatter={(value) => Number(value).toFixed(2)}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              offset: -50,
              style: {
                textAnchor: 'middle',
                fontSize: '12px',
                fontWeight: 'bold'
              }
            }}
            padding={{ left: 20 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #ddd'
            }}
            labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-GB')}`}
            formatter={(value) => [`${Number(value).toFixed(2)} ${displayUnit}`, tooltipLabel]}
          />
          <RechartsLegend />
          <Line
            type="monotone"
            dataKey={dataType === 'riverdepth' ? 'depth' : 'streamflow'}
            stroke="#1f77b4"
            name={tooltipLabel}
            dot={true}
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
    { color: '#FF0000', label: 'Group 4 Alert' },
    { color: '#FFFF00', label: 'Group 2 Alert' },
    { color: '#45cbf7', label: 'Group 1 Alert' },
  ]
};

const GEOFSM_LEGEND = {
  title: 'GeoFSM',
  items: [
    { color: '#2c7fb8', label: 'Low Risk' },
    { color: '#7fcdbb', label: 'Medium Risk' },
    { color: '#edf8b1', label: 'High Risk' },
  ]
};

const MapLegend = ({ legendUrl, title }) => {
  const needsCustomLegend = () => {
    return title === 'Alerts Map' || legendUrl?.includes('floodwatch:Alerts') || 
           title === 'GeoFSM' || legendUrl?.includes('floodwatch:geofsm_layer');
  };

  if (needsCustomLegend()) {
    const legendData = title === 'GeoFSM' || legendUrl?.includes('floodwatch:geofsm_layer') 
      ? GEOFSM_LEGEND 
      : ALERT_LEGEND;

    return (
      <div className="map-legend">
        <h5>{legendData.title}</h5>
        <div className="legend-items">
          {legendData.items.map((item, index) => (
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

  return legendUrl ? (
    <div className="map-legend">
      <h5>{title}</h5>
      <img 
        src={legendUrl} 
        alt={`Legend for ${title}`} 
        onError={(e) => e.target.style.display = 'none'} 
      />
    </div>
  ) : null;
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
  showGeoFSM,
  setShowGeoFSM,
  selectedStation
}) => {
  return (
    <div className="tabbed-sidebar">
      <Tab.Container defaultActiveKey="forecast">
        <Nav variant="tabs" className="sidebar-tabs">
          <Nav.Item>
            <Nav.Link eventKey="forecast" className="tab-link">Sector Layers</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="monitoring" className="tab-link">Impact Layers</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
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
                  <label htmlFor="monitoring-stations-toggle">fp_sections_igad</label>
                </ListGroup.Item>
                <ListGroup.Item>
                  <div className="toggle-switch-small">
                    <input
                      type="checkbox"
                      id="geofsm-toggle"
                      checked={showGeoFSM}
                      onChange={() => setShowGeoFSM(prev => !prev)}
                    />
                    <label htmlFor="geofsm-toggle" className="toggle-slider-small"></label>
                  </div>
                  <label htmlFor="geofsm-toggle">GeoSFM</label>
                </ListGroup.Item>
              </ListGroup>

              <LayerSelector 
                title="Boundary Layers" 
                layers={boundaryLayers} 
                selectedLayers={selectedLayers} 
                onLayerSelect={onLayerSelect} 
              />

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
      
      const layersArray = Array.from(selectedLayers);
      
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetFeatureInfo',
        QUERY_LAYERS: layersArray.join(','),
        LAYERS: layersArray.join(','),
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
        
        if (data && data.features && Array.isArray(data.features) && data.features.length > 0) {
          const featuresWithPosition = data.features.map(feature => ({
            feature,
            position: e.latlng
          }));
          onFeatureInfo(featuresWithPosition);
        }
      } catch (error) {
        console.error('Error fetching feature info:', error);
      }
    }
  });

  return null;
};

/********************************************************************************
 * MAPVIEWER COMPONENT - Updated to maintain full data
 *******************************************************************************/
const MapViewer = () => {
  const [map, setMap] = useState(null);
  const [selectedLayers, setSelectedLayers] = useState(new Set());
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
  const [chartType, setChartType] = useState('discharge');
  const [geoFSMDataType, setGeoFSMDataType] = useState('riverdepth');
  const [availableDataTypes, setAvailableDataTypes] = useState([]);
  const [featurePopups, setFeaturePopups] = useState([]);

  useEffect(() => {
    if (showMonitoringStations) {
      fetch('merged_data.geojson')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (data && data.features) {
            data.features.forEach(feature => {
              if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates;
                feature.properties.latitude = coords[1];
                feature.properties.longitude = coords[0];
              }
            });
            setMonitoringData(data);
          }
        })
        .catch(error => console.error('Error loading monitoring data:', error));
    } else {
      setMonitoringData(null);
      setTimeSeriesData([]);
      setSelectedStation(null);
    }
  }, [showMonitoringStations]);

  useEffect(() => {
    if (showGeoFSM) {
      fetch('hydro_data_with_locations.geojson')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (data && data.features) {
            data.features.forEach(feature => {
              if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates;
                feature.properties.latitude = coords[1];
                feature.properties.longitude = coords[0];
              }
            });
            setGeoFSMData(data);
            const validTypes = ['riverdepth', 'streamflow'];
            const dataTypes = [...new Set(data.features
              .map(f => f.properties.data_type)
              .filter(type => type && validTypes.includes(type)))];
            setAvailableDataTypes(dataTypes.length > 0 ? dataTypes : ['riverdepth']);
            setGeoFSMDataType(dataTypes[0] || 'riverdepth');

            // Pre-process all data for the chart
            const allTimeSeries = data.features
              .reduce((acc, f) => {
                const timestamp = new Date(f.properties.timestamp);
                if (isNaN(timestamp.getTime())) return acc;

                const existing = acc.find(item => item.timestamp.getTime() === timestamp.getTime());
                if (existing) {
                  if (f.properties.data_type === 'riverdepth') {
                    existing.depth = Number(f.properties.value) || 0;
                  } else if (f.properties.data_type === 'streamflow') {
                    existing.streamflow = Number(f.properties.value) || 0;
                  }
                } else {
                  acc.push({
                    timestamp,
                    depth: f.properties.data_type === 'riverdepth' ? Number(f.properties.value) || 0 : 0,
                    streamflow: f.properties.data_type === 'streamflow' ? Number(f.properties.value) || 0 : 0
                  });
                }
                return acc;
              }, [])
              .sort((a, b) => a.timestamp - b.timestamp);
            setGeoFSMTimeSeriesData(allTimeSeries);
          }
        })
        .catch(error => console.error('Error loading GeoFSM data:', error));
    } else {
      setGeoFSMData(null);
      setGeoFSMTimeSeriesData([]);
      setAvailableDataTypes([]);
      setSelectedStation(null);
    }
  }, [showGeoFSM]);

  const handleLayerSelection = useCallback((layer) => {
    setSelectedLayers(prev => {
      const newSelectedLayers = new Set(prev);
      const isImpactLayer = IMPACT_LAYERS.some(l => l.layer === layer.layer);
      
      if (newSelectedLayers.has(layer.layer)) {
        newSelectedLayers.delete(layer.layer);
        if (activeLegend === layer.legend) setActiveLegend(null);
        setFeaturePopups([]);
        setShowChart(false);
        setSelectedStation(null);
        setTimeSeriesData([]);
        setGeoFSMTimeSeriesData([]);
      } else {
        if (isImpactLayer) {
          IMPACT_LAYERS.forEach(l => newSelectedLayers.delete(l.layer));
        }
        newSelectedLayers.add(layer.layer);
        setActiveLegend(layer.legend);
      }
      return newSelectedLayers;
    });
  }, [activeLegend]);

  const handleStationClick = useCallback((feature) => {
    setSelectedStation(feature);
    setShowChart(true);

    if (!feature?.properties) return;

    const dataType = feature.properties.data_type || 'discharge';
    setChartType(dataType);
    setGeoFSMDataType(dataType === 'discharge' ? 'riverdepth' : dataType);

    try {
      if (dataType === 'riverdepth' || dataType === 'streamflow') {
        const timeSeries = geoFSMData?.features
          ?.filter(f => f.properties.Id === feature.properties.Id)
          .reduce((acc, f) => {
            const timestamp = new Date(f.properties.timestamp);
            if (isNaN(timestamp.getTime())) return acc;

            const existing = acc.find(item => item.timestamp.getTime() === timestamp.getTime());
            if (existing) {
              if (f.properties.data_type === 'riverdepth') {
                existing.depth = Number(f.properties.value) || 0;
              } else if (f.properties.data_type === 'streamflow') {
                existing.streamflow = Number(f.properties.value) || 0;
              }
            } else {
              acc.push({
                timestamp,
                depth: f.properties.data_type === 'riverdepth' ? Number(f.properties.value) || 0 : 0,
                streamflow: f.properties.data_type === 'streamflow' ? Number(f.properties.value) || 0 : 0
              });
            }
            return acc;
          }, [])
          .sort((a, b) => a.timestamp - b.timestamp) || [];
        setGeoFSMTimeSeriesData(timeSeries);
        setTimeSeriesData([]);
      } else {
        const timePeriod = feature.properties.time_period?.split(',')?.map(t => t.trim()) || [];
        const gfsValues = feature.properties['time_series_discharge_simulated-gfs']
          ?.split(',')
          .map(val => Number(val.trim()) || 0) || [];
        const iconValues = feature.properties['time_series_discharge_simulated-icon']
          ?.split(',')
          .map(val => Number(val.trim()) || 0) || [];

        const data = timePeriod.map((time, index) => ({
          time: new Date(time),
          gfs: gfsValues[index],
          icon: iconValues[index]
        })).filter(item => 
          !isNaN(item.time.getTime()) && 
          !isNaN(item.gfs) && 
          !isNaN(item.icon)
        );

        setTimeSeriesData(data);
        setGeoFSMTimeSeriesData([]);
      }
    } catch (error) {
      console.error('Error in handleStationClick:', error);
      setTimeSeriesData([]);
      setGeoFSMTimeSeriesData([]);
    }
  }, [geoFSMData]);

  const handleFeatureInfo = useCallback((features) => {
    if (features && Array.isArray(features)) {
      setFeaturePopups(features);
    }
  }, []);

  useEffect(() => {
    setFeaturePopups([]);
  }, [selectedLayers]);

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
          showGeoFSM={showGeoFSM}
          setShowGeoFSM={setShowGeoFSM}
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
            key={mapKey}
          >
            <LayersControl position="topright">
              {BASE_MAPS.map((basemap) => (
                <LayersControl.BaseLayer 
                  key={basemap.name} 
                  name={basemap.name} 
                  checked={basemap.name === 'ICPAC'}
                >
                  <TileLayer url={basemap.url} attribution={basemap.attribution} />
                </LayersControl.BaseLayer>
              ))}

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
            </LayersControl>

            {showMonitoringStations && monitoringData && monitoringData.features && (
              <GeoJSON
                key={`monitoring-stations-${selectedStation?.properties?.SEC_NAME || 'none'}`}
                data={monitoringData}
                pointToLayer={(feature, latlng) => {
                  const isSelected = selectedStation?.properties?.SEC_NAME === feature.properties.SEC_NAME;
                  return L.circleMarker(latlng, {
                    ...MONITORING_STATIONS_CONFIG.style,
                    fillColor: isSelected 
                      ? MONITORING_STATIONS_CONFIG.style.selectedFillColor 
                      : MONITORING_STATIONS_CONFIG.style.fillColor
                  });
                }}
                onEachFeature={(feature, layer) => {
                  layer.on({ click: () => handleStationClick(feature) });
                  const props = feature.properties;
                  layer.bindPopup(`
                    <div class="station-popup">
                      <strong>${props.SEC_NAME || 'Station'}</strong><br/>
                      Basin: ${props.BASIN || 'N/A'}<br/>
                      Current Status: ${props.status || 'Normal'}
                    </div>
                  `);
                }}
              />
            )}

            {showGeoFSM && geoFSMData && geoFSMData.features && (
              <GeoJSON
                key={`geofsm-points-${geoFSMData.features.length}`}
                data={geoFSMData}
                pointToLayer={(feature, latlng) => {
                  return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: "#2c7fb8",
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
                }}
                onEachFeature={(feature, layer) => {
                  const props = feature.properties;
                  layer.bindPopup(`
                    <div class="geofsm-popup">
                      <strong>${props.Name || 'GeoFSM Point'}</strong><br/>
                      Description: ${props.Descriptio || 'N/A'}<br/>
                      Gridcode: ${props.Gridcode || 'N/A'}<br/>
                      Latitude: ${props.Y?.toFixed(4) || 'N/A'}°N<br/>
                      Longitude: ${props.X?.toFixed(4) || 'N/A'}°E<br/>
                      ID: ${props.Id || 'N/A'}
                    </div>
                  `);
                  layer.on({ click: () => handleStationClick(feature) });
                }}
              />
            )}

            <FeatureInfoHandler
              map={map}
              selectedLayers={selectedLayers}
              onFeatureInfo={handleFeatureInfo}
            />

            {featurePopups.map((popup, index) => (
              <Popup
                key={`popup-${index}-${popup.position.lat}-${popup.position.lng}`}
                position={[popup.position.lat, popup.position.lng]}
                onClose={() => {
                  setFeaturePopups(current => current.filter((_, i) => i !== index));
                }}
              >
                <div className="feature-info">
                  {popup.feature.properties && Object.entries(popup.feature.properties)
                    .filter(([key]) => !key.startsWith('_') && key !== 'bbox')
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
                [...HAZARD_LAYERS, ...IMPACT_LAYERS, ...BOUNDARY_LAYERS]
                  .find(layer => layer.legend === activeLegend)?.name || 'Legend'
              } 
            />
          )}
        </div>

        {showChart && (
          <div className="bottom-panel">
            <div className="chart-header">
              <h5>
                {selectedStation?.properties?.SEC_NAME || 
                 (chartType === 'riverdepth' ? 'GeoSFM River Depth' : 
                  chartType === 'streamflow' ? 'GeoSFM Streamflow' : 'Discharge Forecast')}
              </h5>
              {(chartType === 'riverdepth' || chartType === 'streamflow') && availableDataTypes.length > 1 && (
                <select
                  value={geoFSMDataType}
                  onChange={(e) => {
                    setGeoFSMDataType(e.target.value);
                    setChartType(e.target.value);
                  }}
                  style={{ marginLeft: '10px' }}
                >
                  {availableDataTypes.map(type => (
                    <option key={type} value={type}>
                      {type === 'riverdepth' ? 'River Depth' : 'Streamflow'}
                    </option>
                  ))}
                </select>
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
            {chartType === 'riverdepth' || chartType === 'streamflow' ? (
              <GeoSFMChart
                timeSeriesData={geoFSMTimeSeriesData}
                dataType={geoFSMDataType}
              />
            ) : (
              <DischargeChart timeSeriesData={timeSeriesData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapViewer;