import { useState } from 'react'
import axios from 'axios';
import useSWR
 from 'swr';
import { MapContainer,TileLayer,GeoJSON,Popup } from 'react-leaflet'
import { Alert,Spinner } from 'react-bootstrap';  
import './App.css'


const fetcher = (url) => axios.get(url).then((res) => res.data);

function App() {
 const position = [4.6818, 34.9911];
 const zoom = 5;

  return (
    <>
      <MapContainer 
      center={position} zoom={zoom} scrollWheelZoom={true}>

        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> 

      </MapContainer>
        
    </>
  )
}

export default App
