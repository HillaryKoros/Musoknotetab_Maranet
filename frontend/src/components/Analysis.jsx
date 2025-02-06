import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Tabs, Tab, Table } from 'react-bootstrap';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ComposedChart, Area
} from 'recharts';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Analysis = () => {
  const [loading, setLoading] = useState(true);
  const [stationData, setStationData] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [comparisonStation, setComparisonStation] = useState('');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [currentStationInfo, setCurrentStationInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('discharge');
  const [analysisMetrics, setAnalysisMetrics] = useState(null);

  useEffect(() => {
    fetch('merged_data.geojson')
      .then(response => response.json())
      .then(data => {
        const processedData = data.features.map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          }
        }));
        setStationData(processedData);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading station data:', error);
        setLoading(false);
      });
  }, []);

  const calculateMetrics = (data) => {
    if (!data.length) return null;

    const gfsValues = data.map(d => d.gfs);
    const iconValues = data.map(d => d.icon);

    return {
      maxGFS: Math.max(...gfsValues),
      minGFS: Math.min(...gfsValues),
      avgGFS: gfsValues.reduce((a, b) => a + b, 0) / gfsValues.length,
      maxICON: Math.max(...iconValues),
      minICON: Math.min(...iconValues),
      avgICON: iconValues.reduce((a, b) => a + b, 0) / iconValues.length,
      variabilityGFS: Math.sqrt(gfsValues.reduce((a, b) => a + Math.pow(b - (gfsValues.reduce((a, b) => a + b, 0) / gfsValues.length), 2), 0) / gfsValues.length),
      variabilityICON: Math.sqrt(iconValues.reduce((a, b) => a + Math.pow(b - (iconValues.reduce((a, b) => a + b, 0) / iconValues.length), 2), 0) / iconValues.length)
    };
  };

  const processTimeSeriesData = (station) => {
    if (!station?.properties) return [];

    try {
      const { time_period, 'time_series_discharge_simulated-gfs': gfs, 'time_series_discharge_simulated-icon': icon } = station.properties;
      
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

  const handleStationChange = (e) => {
    const stationId = e.target.value;
    setSelectedStation(stationId);

    const station = stationData.find(s => s.properties.SEC_NAME === stationId);
    if (station?.properties) {
      setCurrentStationInfo(station.properties);
      const data = processTimeSeriesData(station);
      setTimeSeriesData(data);
      setAnalysisMetrics(calculateMetrics(data));
    }
  };

  const handleComparisonStationChange = (e) => {
    const stationId = e.target.value;
    setComparisonStation(stationId);

    const station = stationData.find(s => s.properties.SEC_NAME === stationId);
    if (station?.properties) {
      const data = processTimeSeriesData(station);
      setComparisonData(data);
    }
  };

  const exportToPDF = async () => {
    const element = document.getElementById('analysis-content');
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selectedStation}_analysis.pdf`);
  };

  const exportToCSV = () => {
    if (!timeSeriesData.length) return;

    const csvContent = "data:text/csv;charset=utf-8,"
      + "Date,GFS Forecast (m³/s),ICON Forecast (m³/s)\n"
      + timeSeriesData.map(row => 
          `${row.time},${row.gfs?.toFixed(2) || ''},${row.icon?.toFixed(2) || ''}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedStation}_discharge_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading station data...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4" id="analysis-content">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2>Advanced Station Analysis</h2>
            <div className="export-buttons">
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

      <Row className="mb-4">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Primary Station</Form.Label>
            <Form.Select value={selectedStation} onChange={handleStationChange}>
              <option value="">Choose a station...</option>
              {stationData.map(station => (
                <option key={station.properties.SEC_NAME} value={station.properties.SEC_NAME}>
                  {station.properties.SEC_NAME}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Comparison Station (Optional)</Form.Label>
            <Form.Select value={comparisonStation} onChange={handleComparisonStationChange}>
              <option value="">Choose a station for comparison...</option>
              {stationData
                .filter(station => station.properties.SEC_NAME !== selectedStation)
                .map(station => (
                  <option key={station.properties.SEC_NAME} value={station.properties.SEC_NAME}>
                    {station.properties.SEC_NAME}
                  </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {currentStationInfo && (
        <div className="analysis-content">
          <Card className="mb-4">
            <Card.Header style={{ backgroundColor: '#1B5E20', color: 'white' }}>
              <h5 className="mb-0">Station Information</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Card className="text-center p-3">
                    <h6>Basin</h6>
                    <p className="mb-0">{currentStationInfo.BASIN}</p>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center p-3">
                    <h6>Area</h6>
                    <p className="mb-0">{currentStationInfo.AREA} km²</p>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center p-3">
                    <h6>Location</h6>
                    <p className="mb-0">
                      {currentStationInfo.latitude?.toFixed(4)}°N, {currentStationInfo.longitude?.toFixed(4)}°E
                    </p>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center p-3 bg-warning">
                    <h6>Alert Threshold</h6>
                    <p className="mb-0">{currentStationInfo.Q_THR1} m³/s</p>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Tabs activeKey={activeTab} onSelect={k => setActiveTab(k)} className="mb-4">
            <Tab eventKey="discharge" title="Discharge Analysis">
              <Card>
                <Card.Body>
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
                      {comparisonData.length > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="comparison" 
                          stroke="#FF4500" 
                          name="Comparison Station"
                          dot={{ r: 1 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="metrics" title="Statistical Analysis">
              <Card>
                <Card.Body>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>GFS Forecast</th>
                        <th>ICON Forecast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisMetrics && (
                        <>
                          <tr>
                            <td>Maximum Discharge</td>
                            <td>{analysisMetrics.maxGFS.toFixed(2)} m³/s</td>
                            <td>{analysisMetrics.maxICON.toFixed(2)} m³/s</td>
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
                        </>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="anomaly" title="Anomaly Detection">
              <Card>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="gfs" 
                        name="GFS Forecast" 
                        label={{ value: 'GFS Forecast (m³/s)', position: 'bottom' }} 
                      />
                      <YAxis 
                        dataKey="icon" 
                        name="ICON Forecast" 
                        label={{ value: 'ICON Forecast (m³/s)', angle: -90, position: 'insideLeft' }} 
                      />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Legend />
                      <Scatter
                        name="Forecast Comparison"
                        data={timeSeriesData}
                        fill="#1B5E20"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>

          <Card className="mb-4">
            <Card.Header style={{ backgroundColor: '#1B5E20', color: 'white' }}>
              <h5 className="mb-0">Risk Assessment</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                {analysisMetrics && (
                  <>
                    <Col md={4}>
                      <Card className={`text-center p-3 ${analysisMetrics.maxGFS > currentStationInfo.Q_THR1 ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                        <h6>Flood Risk Level</h6>
                        <h4>
                          {analysisMetrics.maxGFS > currentStationInfo.Q_THR1 ? 'High' : 'Low'}
                        </h4>
                        <small>Based on GFS forecast</small>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className="text-center p-3">
                        <h6>Hours Above Threshold</h6>
                        <h4>
                          {timeSeriesData.filter(d => d.gfs > currentStationInfo.Q_THR1).length * 6}
                        </h4>
                        <small>Forecasted duration above alert threshold</small>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className="text-center p-3">
                        <h6>Peak Intensity</h6>
                        <h4>
                          {((analysisMetrics.maxGFS / currentStationInfo.Q_THR1) * 100).toFixed(1)}%
                        </h4>
                        <small>Of alert threshold</small>
                      </Card>
                    </Col>
                  </>
                )}
              </Row>
            </Card.Body>
          </Card>
        </div>
      )}
    </Container>
  );
};

export default Analysis;