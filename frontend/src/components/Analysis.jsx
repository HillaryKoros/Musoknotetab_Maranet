import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Spinner, Table, Alert } from 'react-bootstrap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { FileText, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Analysis = () => {
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState({});
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('');
  const [availableCountries, setAvailableCountries] = useState([]);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [impactData, setImpactData] = useState(null);
  const [error, setError] = useState(null);

  const LAYERS = {
    affectedPop: { endpoint: `/api/affectedPop/`, label: 'Population' },
    affectedGDP: { endpoint: `/api/affectedGDP/`, label: 'GDP' },
    affectedCrops: { endpoint: `/api/affectedCrops/`, label: 'Crops' },
    affectedRoads: { endpoint: `/api/affectedRoads/`, label: 'Roads' },
    displacedPop: { endpoint: `/api/displacedPop/`, label: 'Displaced Population' },
    affectedLivestock: { endpoint: `/api/affectedLivestock/`, label: 'Livestock' },
    affectedGrazingLand: { endpoint: `/api/affectedGrazingLand/`, label: 'Grazing Land' }
  };

  // Initial data load
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      const initialLayer = 'affectedPop';

      try {
        console.log(`Fetching initial data from: ${LAYERS[initialLayer].endpoint}`);
        const response = await fetch(LAYERS[initialLayer].endpoint);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        console.log('Initial API response:', data);

        if (!data.features || !Array.isArray(data.features)) {
          throw new Error('Invalid JSON format: Expected a FeatureCollection with features array');
        }

        setGeoData({ [initialLayer]: data.features });
        const countries = [...new Set(data.features.map(f => f.properties?.name_0).filter(Boolean))].sort();
        console.log('Available countries:', countries);
        setAvailableCountries(countries);

        if (countries.length === 0) setError('No countries found in the API response');
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError(`Failed to load initial data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch layer data and update regions
  useEffect(() => {
    if (!selectedLayer) {
      setAvailableRegions([]);
      setSelectedRegion('');
      setImpactData(null);
      return;
    }

    const fetchLayerData = async () => {
      setError(null);
      try {
        if (!geoData[selectedLayer] && selectedLayer !== 'affectedPop') {
          console.log(`Fetching layer data from: ${LAYERS[selectedLayer].endpoint}`);
          const response = await fetch(LAYERS[selectedLayer].endpoint);
          if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

          const data = await response.json();
          console.log(`API response for ${selectedLayer}:`, data);

          if (!data.features || !Array.isArray(data.features)) throw new Error('Invalid JSON format');
          setGeoData(prev => ({ ...prev, [selectedLayer]: data.features }));
        }

        if (selectedCountry) {
          const regions = [...new Set(
            geoData[selectedLayer]
              ?.filter(f => f.properties.name_0 === selectedCountry)
              .map(f => f.properties?.name_1)
              .filter(Boolean)
          )].sort();

          console.log(`Regions for ${selectedCountry} in ${selectedLayer}:`, regions);
          setAvailableRegions(regions);
          setSelectedRegion('');

          if (regions.length === 0) setError(`No regions found for ${selectedCountry} in ${selectedLayer}`);
        }

        const layerData = geoData[selectedLayer] || [];
        const regionData = selectedRegion 
          ? layerData.find(f => f.properties.name_1 === selectedRegion && f.properties.name_0 === selectedCountry)?.properties 
          : null;

        console.log(`Impact data for ${selectedRegion || 'all'} in ${selectedCountry || 'all'} (${selectedLayer}):`, regionData);
        setImpactData(regionData);
      } catch (error) {
        console.error(`Error fetching ${selectedLayer} data:`, error);
        setError(`Failed to load ${selectedLayer} data: ${error.message}`);
      }
    };

    fetchLayerData();
  }, [selectedLayer, selectedCountry, selectedRegion, geoData]);

  // Event Handlers
  const handleCountryChange = (e) => setSelectedCountry(e.target.value);
  const handleRegionChange = (e) => setSelectedRegion(e.target.value);
  const handleLayerChange = (e) => {
    setSelectedLayer(e.target.value);
    setSelectedCountry('');
    setSelectedRegion('');
    setImpactData(null);
    setAvailableRegions([]);
  };

  // Export to PDF
  const exportToPDF = async () => {
    const element = document.getElementById('analysis-content');
    try {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.setFontSize(16);
      pdf.text('FloodProofs EA Impact Analysis', 20, 20);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      if (selectedLayer) pdf.text(`Layer: ${LAYERS[selectedLayer].label}`, 20, 40);
      if (selectedCountry) pdf.text(`Country: ${selectedCountry}`, 20, 50);
      if (selectedRegion) pdf.text(`Region: ${selectedRegion}`, 20, 60);

      pdf.addImage(imgData, 'PNG', 0, 70, pdfWidth, pdfHeight);
      pdf.save(`floodproofs_ea_${selectedLayer}_${selectedCountry || 'all'}_${selectedRegion || 'all'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Country', 'Region', 'Stock', 'Flood Percentage', 'Flood Total'];
    let rows = [];

    if (selectedRegion && impactData) {
      rows.push([selectedCountry, selectedRegion, impactData.stock?.toLocaleString() || '', impactData.flood_perc?.toFixed(1) || '', impactData.flood_tot?.toLocaleString() || '']);
    } else if (selectedCountry) {
      rows = geoData[selectedLayer]?.filter(f => f.properties.name_0 === selectedCountry).map(f => [f.properties.name_0, f.properties.name_1, f.properties.stock?.toLocaleString() || '', f.properties.flood_perc?.toFixed(1) || '', f.properties.flood_tot?.toLocaleString() || '']) || [];
    }

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `floodproofs_ea_${selectedLayer}_${selectedCountry || 'all'}_${selectedRegion || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render
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
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="display-6 fw-bold">FloodProofs EA Impact Analysis</h2>
            <div>
              <Button variant="outline-primary" className="me-2" onClick={exportToPDF} disabled={!selectedCountry}>
                <FileText className="me-1" size={16} /> Export PDF
              </Button>
              <Button variant="outline-primary" onClick={exportToCSV} disabled={!selectedCountry}>
                <FileSpreadsheet className="me-1" size={16} /> Export CSV
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}

      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0 fw-bold">Analysis Filters</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Impact Layer</Form.Label>
                <Form.Select value={selectedLayer} onChange={handleLayerChange} className="border-2">
                  <option value="">Select an Impact Layer</option>
                  {Object.entries(LAYERS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Country</Form.Label>
                <Form.Select value={selectedCountry} onChange={handleCountryChange} className="border-2" disabled={!selectedLayer}>
                  <option value="">Select a Country</option>
                  {availableCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-bold">Region</Form.Label>
                <Form.Select value={selectedRegion} onChange={handleRegionChange} className="border-2" disabled={!selectedCountry || availableRegions.length === 0}>
                  <option value="">Select a Region (Optional)</option>
                  {availableRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {selectedLayer && selectedCountry && geoData[selectedLayer] ? (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-warning text-dark">
            <h5 className="mb-0 fw-bold">
              {LAYERS[selectedLayer].label} Analysis - {selectedCountry} 
              {selectedRegion ? ` - ${selectedRegion}` : ' (All Regions)'}
            </h5>
          </Card.Header>
          <Card.Body>
            {selectedRegion && impactData ? (
              <Row>
                <Col md={4}>
                  <Card className="mb-3">
                    <Card.Header className="bg-primary text-white">
                      <h6 className="mb-0 fw-bold">Impact Breakdown</h6>
                    </Card.Header>
                    <Card.Body>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Flooded', value: impactData.flood_tot || 0 },
                              { name: 'Stock', value: impactData.stock || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                            labelLine={false}
                          >
                            <Cell fill="#ff7675" />
                            <Cell fill="#74b9ff" />
                          </Pie>
                          <Tooltip formatter={(value) => value.toLocaleString()} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={8}>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td>Stock</td><td>{impactData.stock?.toLocaleString()}</td></tr>
                      <tr><td>Flood Total</td><td>{impactData.flood_tot?.toLocaleString()}</td></tr>
                      <tr><td>Flood Percentage</td><td>{impactData.flood_perc?.toFixed(1)}%</td></tr>
                      <tr><td>Country</td><td>{impactData.name_0}</td></tr>
                      <tr><td>Region</td><td>{impactData.name_1}</td></tr>
                      <tr><td>Province Code</td><td>{impactData.cod}</td></tr>
                    </tbody>
                  </Table>
                </Col>
              </Row>
            ) : (
              <Row>
                <Col>
                  <h6 className="fw-bold mb-3">Comparison Across Regions in {selectedCountry}</h6>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={geoData[selectedLayer]
                      ?.filter(f => f.properties.name_0 === selectedCountry)
                      .map(f => ({
                        name: f.properties.name_1,
                        stock: f.properties.stock,
                        flood_tot: f.properties.flood_tot
                      }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                      <Bar dataKey="stock" fill="#74b9ff" name="Stock" />
                      <Bar dataKey="flood_tot" fill="#ff7675" name="Flooded" />
                    </BarChart>
                  </ResponsiveContainer>
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>
      ) : selectedLayer ? (
        <Card className="text-center p-4">
          <Card.Body>
            <h5 className="text-muted">Please select a country to view analysis</h5>
          </Card.Body>
        </Card>
      ) : null}
    </Container>
  );
};

export default Analysis;