import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';
import Home from './components/Home';
import MapViewer from './components/MapViewer';
import Reports from './components/Reports';
import Analysis from './components/Analysis';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app-wrapper">
        {/* Navbar with custom styles */}
        <Navbar className="navbar-custom" expand="lg">
          <Container>
            <Navbar.Brand as={Link} to="/">East Africa Flood Watch</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/">Home</Nav.Link>
                <Nav.Link as={Link} to="/map">Map Viewer</Nav.Link>
                <Nav.Link as={Link} to="/reports">Reports</Nav.Link>
                <Nav.Link as={Link} to="/analysis">Analysis</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        {/* Main Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapViewer />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/analysis" element={<Analysis />} />
        </Routes>

        {/* Footer
        <footer className="footer-custom">
          © 2025 East Africa Flood Watch | IGAD-ICPAC
        </footer> */}
      </div>
    </Router>
  );
};

export default App;
