import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';
import Home from './components/Home';
import MapViewer from './components/MapViewer';
import Reports from './components/Reports';
import Analysis from './components/Analysis';
import Indicators from './components/Indicators';
import About from './components/About';
import Partners from './components/Partners';
import Contact from './components/Contact';
import leftLogo from '@assets/ICPAC_Website_Header_Logo.svg';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app-wrapper">
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
            {/* Left Logo */}
            <div className="d-flex align-items-center">
              <img
                src={leftLogo}
                alt="Left Logo"
                className="navbar-logo me-3"
                style={{ height: '100px' }}
              />
              <div className="brand-container">
                <div className="brand-text">
                  <span className="text-uppercase" style={{ fontSize: '0.9rem', color: '#fff' }}>
                    East Africa
                  </span>
                  <div className="flood-watch">
                    <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      FLOOD
                    </span>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', marginLeft: '8px' }}>
                      WATCH
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="mx-auto" style={{ gap: '1.5rem' }}>
                <Nav.Link as={NavLink} to="/" className="nav-link" style={{ color: '#fff' }}>
                  HOME
                </Nav.Link>
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
                <Nav.Link as={NavLink} to="/reports" className="nav-link" style={{ color: '#fff' }}>
                  REPORTS
                </Nav.Link>
                <Nav.Link as={NavLink} to="/analysis" className="nav-link" style={{ color: '#fff' }}>
                  ANALYSIS
                </Nav.Link>
                <Nav.Link as={NavLink} to="/indicators" className="nav-link" style={{ color: '#fff' }}>
                  FLOOD INDICATORS
                </Nav.Link>
                <Nav.Link as={NavLink} to="/about" className="nav-link" style={{ color: '#fff' }}>
                  ABOUT
                </Nav.Link>
                <Nav.Link as={NavLink} to="/partners" className="nav-link" style={{ color: '#fff' }}>
                  PARTNERS
                </Nav.Link>
                <Nav.Link as={NavLink} to="/contact" className="nav-link" style={{ color: '#fff' }}>
                  CONTACT US
                </Nav.Link>
              </Nav>
            </Navbar.Collapse>

            {/* Right Logo
            <img
              src="/src/assets/cima_research_foundation_logo.jpg"
              alt="Right Logo"
              className="navbar-logo"
              style={{ height: '100px' }}
            /> */}
          </Container>
        </Navbar>

        {/* Main Routes */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapViewer />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/indicators" element={<Indicators/>} />
            <Route path="/about" element={<About/>} />
            <Route path="/partners" element={<Partners/>} />
            <Route path="/contact" element={<Contact/>} />
          </Routes>
        </div>

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