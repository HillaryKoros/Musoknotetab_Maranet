import React, { useState } from 'react';
import { Container, Row, Col, Card, Modal } from 'react-bootstrap';

const FloodIndicators = () => {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  const indicators = [
    {
      title: "Water Level Monitoring",
      description: "Comprehensive monitoring of major river basins",
      image: "water-level-monitoring.png",
      icon: "🌊",
      details: "Real-time river and reservoir water levels tracked using remote sensors and satellite data. This helps predict potential flooding and informs decision-making."
    },
    {
      title: "Precipitation Forecasts",
      description: "Advanced rainfall prediction models",
      image: "precipitation-forecasts.jpg",
      icon: "☔",
      details: "Utilizing satellite imagery, weather station data, and machine learning to provide accurate rainfall forecasts for the East Africa region."
    },
    {
      title: "Flood Risk Assessment",
      description: "Predictive flood vulnerability mapping",
      image: "flood-risk-assessment.png",
      icon: "⚠️",
      details: "Analyzing historical flood data, terrain models, and other factors to identify high-risk areas and guide targeted interventions."
    },
    {
      title: "Geographic Vulnerability",
      description: "Location-specific flood susceptibility",
      image: "geographic-vulnerability.jpg",
      icon: "🗺️",
      details: "GIS-based mapping of flood-prone regions to inform local disaster preparedness and resource allocation."
    }
  ];

  const handleIndicatorClick = (indicator) => {
    setSelectedIndicator(indicator);
    setShowDetailModal(true);
  };

  return (
    <Container fluid className="flood-indicators-page p-4" style={{ backgroundImage: 'url(/assets/flood-background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <h1 className="text-center mb-5" style={{ color: '#1B5E20' }}>
        Flood Indicators
      </h1>

      <Row>
        {indicators.map((indicator, index) => (
          <Col key={index} md={12} className="mb-4">
            <Card
              className="h-100 shadow-sm indicator-card"
              role="button"
              onClick={() => handleIndicatorClick(indicator)}
              style={{
                borderLeft: `5px solid ${
                  indicator.title === 'Flood Risk Assessment' ? '#D32F2F' :
                  indicator.title === 'Geographic Vulnerability' ? '#FFA000' :
                  '#2E7D32'
                }`
              }}
            >
              <Card.Body className="d-flex align-items-center">
                <div className="icon-container me-3" style={{ fontSize: '2rem' }}>
                  {indicator.icon}
                </div>
                <div>
                  <Card.Title className="mb-2">{indicator.title}</Card.Title>
                  <Card.Text className="text-muted">{indicator.description}</Card.Text>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {selectedIndicator && (
        <Modal
          show={showDetailModal}
          onHide={() => setShowDetailModal(false)}
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>{selectedIndicator.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <h4>{selectedIndicator.description}</h4>
                <p>{selectedIndicator.details}</p>
              </Col>
              <Col md={4}>
                <img src={`/assets/${selectedIndicator.image}`} alt={selectedIndicator.title} className="img-fluid" />
              </Col>
            </Row>
          </Modal.Body>
        </Modal>
      )}
    </Container>
  );
};

export default FloodIndicators;