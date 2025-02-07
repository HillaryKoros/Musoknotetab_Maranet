// Import necessary dependencies
import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';

// Import component pages
import Home from './components/Home';
import MapViewer from './components/MapViewer';
import Analysis from './components/Analysis';
import Indicators from './components/Indicators';
import About from './components/About';
import Partners from './components/Partners';
import Contact from './components/Contact';

// Import assets and styles
import leftLogo from '@assets/ICPAC_Website_Header_Logo.svg';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/**
 * Main App component that handles routing and layout structure
 * Includes a navigation bar, main content area, and footer
 */
const App = () => {
  return (
    <Router>
      <div className="app-wrapper">
        {/* Navigation Bar */}
        <Navbar 
          className="navbar-custom" 
          expand="lg" 
          style={{ 
            backgroundColor: '#1B5E20',
            padding: '0.5rem 1rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Container fluid>
            {/* Brand Logo and Text Section */}
            <Nav.Link 
              as={NavLink} 
              to="/map" 
              className="brand-container" 
              style={{ 
                color: '#fff',
                textDecoration: 'none'
              }}
            >
              <div className="brand-text">
                EAST AFRICA FLOOD WATCH
              </div>
            </Nav.Link>

            {/* Mobile Navigation Toggle Button */}
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            
            {/* Navigation Links */}
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="mx-auto" style={{ gap: '2rem' }}> {/* Increased gap between nav items */}
                {/* Home Link */}
                <Nav.Link as={NavLink} to="/" className="nav-link" style={{ color: '#fff' }}>
                  HOME
                </Nav.Link>
                {/* MapViewer Link with special styling */}
                <Nav.Link 
                  as={NavLink} 
                  to="/map" 
                  className="nav-link" 
                  style={{ 
                    color: '#FFC107',
                    backgroundColor: '#2E7D32',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px'
                  }}
                >
                  MAPVIEWER
                </Nav.Link>
                {/* Analysis Link */}
                <Nav.Link as={NavLink} to="/analysis" className="nav-link" style={{ color: '#fff' }}>
                  ANALYSIS
                </Nav.Link>
                {/* Indicators Link */}
                <Nav.Link as={NavLink} to="/indicators" className="nav-link" style={{ color: '#fff' }}>
                  FLOOD INDICATORS
                </Nav.Link>
                {/* About Link */}
                <Nav.Link as={NavLink} to="/about" className="nav-link" style={{ color: '#fff' }}>
                  ABOUT
                </Nav.Link>
                {/* Partners Link */}
                <Nav.Link as={NavLink} to="/partners" className="nav-link" style={{ color: '#fff' }}>
                  PARTNERS
                </Nav.Link>
                {/* Contact Link */}
                <Nav.Link as={NavLink} to="/contact" className="nav-link" style={{ color: '#fff' }}>
                  CONTACT US
                </Nav.Link>
              </Nav>
            </Navbar.Collapse>

            {/* ICPAC Logo */}
            <div className="d-flex align-items-center">
              <img
                src={leftLogo}
                alt="ICPAC Logo"
                className="navbar-logo ms-3"
                style={{ height: '60px' }}
              />
            </div>
          </Container>
        </Navbar>

        {/* Main Content Area */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapViewer />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/indicators" element={<Indicators/>} />
            <Route path="/about" element={<About/>} />
            <Route path="/partners" element={<Partners/>} />
            <Route path="/contact" element={<Contact/>} />
          </Routes>
        </div>

        {/* Footer Section */}
        <footer 
          className="footer-custom"
          style={{
            backgroundColor: '#1B5E20',
            color: '#fff',
            padding: '1rem',
            textAlign: 'center',
            position: 'fixed',
            bottom: 0,
            width: '100%',
            zIndex: 1000
          }}
        >
          © 2025 East Africa Flood Watch | IGAD-ICPAC
        </footer>
      </div>
    </Router>
  );
};

export default App;