import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Tabs, Tab, Table } from 'react-bootstrap';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import { FileText, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import leftLogo from '@assets/ICPAC_Website_Header_Logo.svg';


const Analysis = () => {
  // State Management
  const [loading, setLoading] = useState(true);
  const [stationData, setStationData] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [currentStationInfo, setCurrentStationInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [analysisMetrics, setAnalysisMetrics] = useState(null);
  const [selectedBasin, setSelectedBasin] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [availableBasins, setAvailableBasins] = useState([]);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [availableStations, setAvailableStations] = useState([]);
  const [regionalDischarge, setRegionalDischarge] = useState([]);
  const [impactData, setImpactData] = useState({
    population: null,
    gdp: null,
    crops: null,
    roads: null,
    livestock: null,
    grazingLand: null
  });

  // Initial data load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('merged_data.geojson');
        const data = await response.json();
        
        const processedData = data.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          }
        }));

        setStationData(processedData);
        
        // Get unique admin areas
        const admins = [...new Set(processedData.map(station => 
          station.properties.ADMIN_B_L1
        ))].filter(Boolean).sort();
        
        setAvailableAdmins(admins);
        setLoading(false);
      } catch (error) {
        console.error('Error loading station data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update available basins when admin changes
  useEffect(() => {
    if (!selectedAdmin) {
      setAvailableBasins([]);
      setSelectedBasin('');
      return;
    }

    // Filter stations by selected admin
    const adminStations = stationData.filter(station => 
      station.properties.ADMIN_B_L1 === selectedAdmin
    );

    // Get unique basins within the selected admin area
    const basins = [...new Set(adminStations.map(station => 
      station.properties.BASIN
    ))].filter(Boolean).sort();

    setAvailableBasins(basins);
    setSelectedBasin('');
    
    // Reset station-specific selections
    setSelectedStation('');
    setTimeSeriesData([]);
    setAnalysisMetrics(null);
  }, [selectedAdmin, stationData]);

  // Update available stations when basin changes
  useEffect(() => {
    if (!selectedAdmin || !selectedBasin) {
      setAvailableStations([]);
      setSelectedStation('');
      return;
    }

    // Filter stations by both admin and basin
    const filteredStations = stationData.filter(station => 
      station.properties.ADMIN_B_L1 === selectedAdmin &&
      station.properties.BASIN === selectedBasin
    );

    setAvailableStations(filteredStations);
    
    // Process regional discharge data
    const regionalData = filteredStations.map(station => ({
      name: station.properties.SEC_NAME,
      data: processTimeSeriesData(station),
      threshold: station.properties.Q_THR1,
      location: {
        lat: station.properties.latitude,
        lon: station.properties.longitude
      }
    }));

    setRegionalDischarge(regionalData);
    
    // Reset station-specific selections
    setSelectedStation('');
    setTimeSeriesData([]);
    setAnalysisMetrics(null);
  }, [selectedAdmin, selectedBasin, stationData]);

  // Fetch impact data when admin area changes
  useEffect(() => {
    if (!selectedAdmin) return;

    const fetchImpactData = async () => {
      try {
        const baseUrl = 'http://10.10.1.13:8090/api';
        const endpoints = {
          population: `${baseUrl}/affectedPop/admin/${selectedAdmin}`,
          gdp: `${baseUrl}/affectedGDP/admin/${selectedAdmin}`,
          crops: `${baseUrl}/affectedCrops/admin/${selectedAdmin}`,
          roads: `${baseUrl}/affectedRoads/admin/${selectedAdmin}`,
          livestock: `${baseUrl}/affectedLivestock/admin/${selectedAdmin}`,
          grazingLand: `${baseUrl}/affectedGrazingLand/admin/${selectedAdmin}`
        };

        const responses = await Promise.all(
          Object.entries(endpoints).map(async ([key, url]) => {
            const response = await fetch(url);
            const data = await response.json();
            return [key, data];
          })
        );

        setImpactData(Object.fromEntries(responses));
      } catch (error) {
        console.error('Error fetching impact data:', error);
      }
    };

    fetchImpactData();
  }, [selectedAdmin]);

  // Utility Functions
  const processTimeSeriesData = (station) => {
    if (!station?.properties) return [];

    try {
      const { 
        time_period, 
        'time_series_discharge_simulated-gfs': gfs, 
        'time_series_discharge_simulated-icon': icon 
      } = station.properties;
      
      const times = time_period.split(',');
      const gfsValues = gfs.split(',').map(Number);
      const iconValues = icon.split(',').map(Number);
      
      return times.map((time, i) => ({
        time: time.split(' ')[0],
        gfs: gfsValues[i],
        icon: iconValues[i]
      })).filter((_, index) => index % 6 === 0);
    } catch (error) {
      console.error('Error parsing time series data:', error);
      return [];
    }
  };

  const calculateMetrics = (data, threshold) => {
    if (!data?.length) return null;

    const gfsValues = data.map(d => d.gfs);
    const iconValues = data.map(d => d.icon);

    return {
      maxGFS: Math.max(...gfsValues),
      minGFS: Math.min(...gfsValues),
      avgGFS: gfsValues.reduce((a, b) => a + b, 0) / gfsValues.length,
      maxICON: Math.max(...iconValues),
      minICON: Math.min(...iconValues),
      avgICON: iconValues.reduce((a, b) => a + b, 0) / iconValues.length,
      variabilityGFS: Math.sqrt(gfsValues.reduce((a, b) => 
        a + Math.pow(b - (gfsValues.reduce((a, b) => a + b, 0) / gfsValues.length), 2), 0) / gfsValues.length),
      variabilityICON: Math.sqrt(iconValues.reduce((a, b) => 
        a + Math.pow(b - (iconValues.reduce((a, b) => a + b, 0) / iconValues.length), 2), 0) / iconValues.length),
      thresholdExceededHours: threshold ? data.filter(d => d.gfs > threshold).length * 6 : 0,
      peakIntensity: threshold ? ((Math.max(...gfsValues) / threshold) * 100) : 0
    };
  };

  // Event Handlers
  const handleAdminChange = (e) => {
    setSelectedAdmin(e.target.value);
  };

  const handleBasinChange = (e) => {
    setSelectedBasin(e.target.value);
  };

  const handleStationChange = (e) => {
    const stationId = e.target.value;
    setSelectedStation(stationId);

    const station = availableStations.find(s => s.properties.SEC_NAME === stationId);
    if (station?.properties) {
      setCurrentStationInfo(station.properties);
      const data = processTimeSeriesData(station);
      setTimeSeriesData(data);
      setAnalysisMetrics(calculateMetrics(data, station.properties.Q_THR1));
    }
  };

  // ==================== Export Functions ====================
  const exportToPDF = async () => {
    const element = document.getElementById('analysis-content');
    try {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Header
      pdf.setFontSize(16);
      pdf.text('Flood Impact Analysis Report', 20, 20);
      
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      if (selectedAdmin) pdf.text(`Admin Area: ${selectedAdmin}`, 20, 40);
      if (selectedBasin) pdf.text(`Basin: ${selectedBasin}`, 20, 45);
      if (selectedStation) pdf.text(`Station: ${selectedStation}`, 20, 50);

      // Main content
      pdf.addImage(imgData, 'PNG', 0, 60, pdfWidth, pdfHeight);


      // Regional discharge summary
      if (regionalDischarge.length > 0) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text('Regional Discharge Summary', 20, 20);
        
        let y = 40;
        regionalDischarge.forEach(station => {
          const metrics = calculateMetrics(station.data, station.threshold);
          pdf.setFontSize(12);
          pdf.text(`Station: ${station.name}`, 20, y);
          y += 10;
          
          pdf.setFontSize(10);
          pdf.text(`Max GFS: ${metrics.maxGFS.toFixed(2)} m³/s`, 30, y); y += 8;
          pdf.text(`Max ICON: ${metrics.maxICON.toFixed(2)} m³/s`, 30, y); y += 8;
          pdf.text(`Hours Above Threshold: ${metrics.thresholdExceededHours}`, 30, y);
          y += 15;
        });
      }
      
      pdf.save(`flood_analysis_${selectedAdmin || selectedBasin || selectedStation}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Station',
      'GFS Discharge (m³/s)',
      'ICON Discharge (m³/s)',
      'Alert Threshold (m³/s)',
      'Population Affected',
      'GDP Impact ($)',
      'Cropland (ha)',
      'Roads (km)'
    ];

    let rows = [];
    if (selectedStation && timeSeriesData.length) {
      // Single station export
      rows = timeSeriesData.map(row => [
        row.time,
        selectedStation,
        row.gfs?.toFixed(2),
        row.icon?.toFixed(2),
        currentStationInfo?.Q_THR1,
        impactData.population?.affected || '',
        impactData.gdp?.value || '',
        impactData.crops?.affected || '',
        impactData.roads?.length || ''
      ]);
    } else if (regionalDischarge.length) {
      // Regional data export
      regionalDischarge.forEach(station => {
        rows.push(...station.data.map(row => [
          row.time,
          station.name,
          row.gfs?.toFixed(2),
          row.icon?.toFixed(2),
          station.threshold,
          impactData.population?.affected || '',
          impactData.gdp?.value || '',
          impactData.crops?.affected || '',
          impactData.roads?.length || ''
        ]));
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 
      `flood_analysis_${selectedAdmin || selectedBasin || selectedStation}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== Render Functions ====================

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading data...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4" id="analysis-content">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2>Flood Impact Analysis</h2>
            <div>
              <Button variant="outline-primary" className="me-2" onClick={exportToPDF}>
                <FileText className="me-1" size={16} /> Export PDF
              </Button>
              <Button variant="outline-primary" onClick={exportToCSV}>
                <FileSpreadsheet className="me-1" size={16} /> Export CSV
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0">Analysis Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Administrative Area</Form.Label>
                <Form.Select 
                  value={selectedAdmin}
                  onChange={handleAdminChange}
                  className="border-2"
                >
                  <option value="">Select Administrative Area...</option>
                  {availableAdmins.map(admin => (
                    <option key={admin} value={admin}>{admin}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Basin</Form.Label>
                <Form.Select 
                  value={selectedBasin}
                  onChange={handleBasinChange}
                  disabled={!selectedAdmin}
                  className="border-2"
                >
                  <option value="">Select Basin...</option>
                  {availableBasins.map(basin => (
                    <option key={basin} value={basin}>{basin}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Station</Form.Label>
                <Form.Select 
                  value={selectedStation}
                  onChange={handleStationChange}
                  disabled={!selectedBasin}
                  className="border-2"
                >
                  <option value="">Select Station...</option>
                  {availableStations.map(station => (
                    <option key={station.properties.SEC_NAME} value={station.properties.SEC_NAME}>
                      {station.properties.SEC_NAME}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Regional Discharge Analysis */}
      {regionalDischarge.length > 0 && (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-success text-white">
            <h5 className="mb-0">Regional Discharge Analysis - {selectedBasin}</h5>
          </Card.Header>
          <Card.Body>
            {/* <ResponsiveContainer width="100%" height={400}>
              <ComposedChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time"
                  allowDuplicatedCategory={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  fontSize={12}
                />
                <YAxis 
                  label={{ 
                    value: 'Discharge (m³/s)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 12 }
                  }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value?.toFixed(2)} m³/s`,
                    name.split('_')[0]
                  ]}
                />
                <Legend />
                {regionalDischarge.map((station, idx) => (
                  <React.Fragment key={station.name}>
                    <Line 
                      data={station.data}
                      type="monotone"
                      dataKey="gfs"
                      name={`${station.name}_GFS`}
                      stroke={`hsl(${(idx * 30) % 360}, 70%, 50%)`}
                      dot={{ r: 1 }}
                    />
                    <Line 
                      data={station.data}
                      type="monotone"
                      dataKey="icon"
                      name={`${station.name}_ICON`}
                      stroke={`hsl(${((idx * 30) + 15) % 360}, 70%, 50%)`}
                      dot={{ r: 1 }}
                      strokeDasharray="5 5"
                    />
                  </React.Fragment>
                ))}
              </ComposedChart>
            </ResponsiveContainer> */}

            <div className="mt-4">
              <h6 className="fw-bold mb-3">Regional Station Analysis</h6>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th>Max GFS (m³/s)</th>
                    <th>Max ICON (m³/s)</th>
                    <th>Alert Threshold (m³/s)</th>
                    <th>Hours Above Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {regionalDischarge.map(station => {
                    const metrics = calculateMetrics(station.data, station.threshold);
                    return (
                      <tr key={station.name}>
                        <td>{station.name}</td>
                        <td className={metrics.maxGFS > station.threshold ? 'text-danger fw-bold' : ''}>
                          {metrics.maxGFS.toFixed(2)}
                        </td>
                        <td className={metrics.maxICON > station.threshold ? 'text-danger fw-bold' : ''}>
                          {metrics.maxICON.toFixed(2)}
                        </td>
                        <td>{station.threshold}</td>
                        <td className={metrics.thresholdExceededHours > 24 ? 'text-danger fw-bold' : ''}>
                          {metrics.thresholdExceededHours}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Impact Analysis
      {selectedAdmin && impactData && (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-warning">
            <h5 className="mb-0">Impact Analysis - {selectedAdmin}</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={4}>
                <Card className="mb-3">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">Population Impact</h6>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Affected', value: impactData.population?.affected || 0 },
                            { 
                              name: 'Unaffected', 
                              value: (impactData.population?.total || 0) - 
                                    (impactData.population?.affected || 0) 
                            }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                        >
                          <Cell fill="#ff7675" />
                          <Cell fill="#74b9ff" />
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center mt-3">
                      <h6>Total: {impactData.population?.total?.toLocaleString()}</h6>
                      <h6>Affected: {impactData.population?.affected?.toLocaleString()}</h6>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={4}>
                <Card className="mb-3">
                  <Card.Header className="bg-success text-white">
                    <h6 className="mb-0">Land Use Impact</h6>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Cropland', affected: impactData.crops?.affected || 0 },
                        { name: 'Grazing', affected: impactData.grazingLand?.affected || 0 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ 
                          value: 'Hectares', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fontSize: 12 }
                        }} />
                        <Tooltip formatter={(value) => `${value.toLocaleString()} ha`} />
                        <Bar dataKey="affected" fill="#55efc4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={4}>
                <Card className="mb-3">
                  <Card.Header className="bg-info text-white">
                    <h6 className="mb-0">Economic Impact</h6>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'GDP', value: impactData.gdp?.value || 0 },
                        { name: 'Agriculture', value: impactData.crops?.value || 0 },
                        { name: 'Livestock', value: impactData.livestock?.value || 0 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ 
                          value: 'USD', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fontSize: 12 }
                        }} />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Bar dataKey="value" fill="#a29bfe" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Table striped bordered hover responsive className="mt-4">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total</th>
                  <th>Affected</th>
                  <th>Percentage</th>
                  <th>Economic Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Population</td>
                  <td>{impactData.population?.total?.toLocaleString()}</td>
                  <td>{impactData.population?.affected?.toLocaleString()}</td>
                  <td>
                    {((impactData.population?.affected / impactData.population?.total) * 100 || 0).toFixed(1)}%
                  </td>
                  <td>-</td>
                </tr>
                <tr>
                  <td>Cropland</td>
                  <td>{impactData.crops?.total?.toLocaleString()} ha</td>
                  <td>{impactData.crops?.affected?.toLocaleString()} ha</td>
                  <td>
                    {((impactData.crops?.affected / impactData.crops?.total) * 100 || 0).toFixed(1)}%
                  </td>
                  <td>${impactData.crops?.value?.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Grazing Land</td>
                  <td>{impactData.grazingLand?.total?.toLocaleString()} ha</td>
                  <td>{impactData.grazingLand?.affected?.toLocaleString()} ha</td>
                  <td>
                    {((impactData.grazingLand?.affected / impactData.grazingLand?.total) * 100 || 0).toFixed(1)}%
                  </td>
                  <td>${impactData.grazingLand?.value?.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Roads</td>
                  <td>{impactData.roads?.total?.toLocaleString()} km</td>
                  <td>{impactData.roads?.length?.toLocaleString()} km</td>
                  <td>
                    {((impactData.roads?.length / impactData.roads?.total) * 100 || 0).toFixed(1)}%
                  </td>
                  <td>${impactData.roads?.value?.toLocaleString()}</td>
                </tr>
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )} */}

      {/* Station Analysis */}
      {currentStationInfo && (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-info text-white">
            <h5 className="mb-0">Station Analysis - {currentStationInfo.SEC_NAME}</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={3}>
                <Card className="text-center shadow-sm h-100">
                  <Card.Body>
                    <h6 className="fw-bold mb-3">Basin</h6>
                    <p className="mb-0 fs-5">{currentStationInfo.BASIN}</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center shadow-sm h-100">
                  <Card.Body>
                    <h6 className="fw-bold mb-3">Area</h6>
                    <p className="mb-0 fs-5">{currentStationInfo.AREA} km²</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center shadow-sm h-100">
                  <Card.Body>
                    <h6 className="fw-bold mb-3">Location</h6>
                    <p className="mb-0">
                      <span className="fs-5">{currentStationInfo.latitude?.toFixed(4)}°N</span><br/>
                      <span className="fs-5">{currentStationInfo.longitude?.toFixed(4)}°E</span>
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center shadow-sm h-100 bg-warning bg-opacity-10">
                  <Card.Body>
                    <h6 className="fw-bold mb-3">Alert Threshold</h6>
                    <p className="mb-0 fs-5">{currentStationInfo.Q_THR1} m³/s</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="mt-4">
              <Col>
                <h6 className="fw-bold mb-3">Discharge Analysis</h6>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      angle={-45} 
                      textAnchor="end" 
                      height={60}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Discharge (m³/s)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fontSize: 12 }
                      }}
                    />
                    <Tooltip formatter={(value) => [`${value.toFixed(2)} m³/s`]} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="gfs" 
                      stroke="#4169E1" 
                      name="GFS Forecast"
                      dot={{ r: 1 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="icon" 
                      stroke="#32CD32" 
                      name="ICON Forecast"
                      dot={{ r: 1 }}
                    />
                    {currentStationInfo.Q_THR1 && (
                      <Line
                        type="monotone"
                        dataKey={() => currentStationInfo.Q_THR1}
                        stroke="#FF0000"
                        strokeDasharray="5 5"
                        name="Alert Threshold"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </Col>
            </Row>

            {analysisMetrics && (
              <Row className="mt-4">
                <Col>
                  <h6 className="fw-bold mb-3">Statistical Analysis</h6>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>GFS Forecast</th>
                        <th>ICON Forecast</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Maximum Discharge</td>
                        <td className={analysisMetrics.maxGFS > currentStationInfo.Q_THR1 ? 'text-danger fw-bold' : ''}>
                          {analysisMetrics.maxGFS.toFixed(2)} m³/s
                        </td>
                        <td className={analysisMetrics.maxICON > currentStationInfo.Q_THR1 ? 'text-danger fw-bold' : ''}>
                          {analysisMetrics.maxICON.toFixed(2)} m³/s
                        </td>
                      </tr>
                      <tr>
                        <td>Minimum Discharge</td>
                        <td>{analysisMetrics.minGFS.toFixed(2)} m³/s</td>
                        <td>{analysisMetrics.minICON.toFixed(2)} m³/s</td>
                      </tr>
                      <tr>
                        <td>Average Discharge</td>
                        <td>{analysisMetrics.avgGFS.toFixed(2)} m³/s</td>
                        <td>{analysisMetrics.avgICON.toFixed(2)} m³/s</td>
                      </tr>
                      <tr>
                        <td>Variability (Std Dev)</td>
                        <td>{analysisMetrics.variabilityGFS.toFixed(2)} m³/s</td>
                        <td>{analysisMetrics.variabilityICON.toFixed(2)} m³/s</td>
                      </tr>
                      <tr>
                        <td>Hours Above Threshold</td>
                        <td colSpan="2" className={analysisMetrics.thresholdExceededHours > 24 ? 'text-danger fw-bold' : ''}>
                          {analysisMetrics.thresholdExceededHours}
                        </td>
                      </tr>
                      <tr>
                        <td>Peak Intensity (% of threshold)</td>
                        <td colSpan="2" className={analysisMetrics.peakIntensity > 150 ? 'text-danger fw-bold' : ''}>
                          {analysisMetrics.peakIntensity.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default Analysis;