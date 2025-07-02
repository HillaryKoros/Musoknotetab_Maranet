import React, { useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';

// Export functions
const exportToCSV = (data, filename, stationName = '') => {
  const headers = Object.keys(data[0]).join(',');
  const csvContent = [
    `# ${stationName} - ${filename}`,
    `# Generated on: ${new Date().toLocaleString()}`,
    headers,
    ...data.map(row => Object.values(row).map(val => 
      val instanceof Date ? val.toISOString().split('T')[0] : val
    ).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const exportToPNG = (chartRef, filename, stationName = '') => {
  if (!chartRef.current) return;
  
  const svg = chartRef.current.querySelector('svg');
  if (!svg) return;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const svgData = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  
  canvas.width = svg.clientWidth || 800;
  canvas.height = svg.clientHeight || 400;
  
  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    // Add title
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText(`${stationName} - ${filename}`, 10, 25);
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };
  
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.src = url;
};

// Component to render a discharge forecast chart
export const DischargeChart = ({ timeSeriesData, selectedSeries = 'both', stationName = '', onSeriesChange }) => {
  const chartRef = useRef(null);
  console.log("DischargeChart received data:", timeSeriesData?.length, "points, series:", selectedSeries);
  
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return <div className="chart-no-data" style={{ padding: '20px', textAlign: 'center' }}>No data available.</div>;
  }

  const processedData = timeSeriesData.map(item => ({
    time: new Date(item.time),
    gfs: selectedSeries === 'icon' ? null : Number(item.gfs) || 0,
    icon: selectedSeries === 'gfs' ? null : Number(item.icon) || 0
  })).filter(item => 
    (selectedSeries === 'both' && (!isNaN(item.gfs) || !isNaN(item.icon))) ||
    (selectedSeries === 'gfs' && !isNaN(item.gfs)) ||
    (selectedSeries === 'icon' && !isNaN(item.icon))
  );

  // Calculate Y-axis domain for better scaling
  const allValues = processedData.flatMap(item => [item.gfs, item.icon].filter(v => v != null && !isNaN(v)));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [Math.max(0, minValue - padding), maxValue + padding];

  console.log("Processed chart data:", processedData.length, "points");


  return (
    <div className="chart-container" ref={chartRef}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={processedData} margin={{ top: 20, right: 30, left: 70, bottom: 80 }}>
            <defs>
              <linearGradient id="gfsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f77b4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#1f77b4" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="iconGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff7f0e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ff7f0e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="time" 
              angle={-45} 
              textAnchor="end" 
              height={100} 
              tickFormatter={(dt) => dt.toLocaleDateString('en-GB')} 
              minTickGap={50}
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              domain={yDomain}
              label={{ 
                value: 'Discharge (m³/s)', 
                angle: -90, 
                position: 'insideLeft', 
                offset: -10, 
                dy: 60, 
                style: { fontSize: '12px', fontWeight: 'bold', fill: '#333' } 
              }}
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => Number(value).toFixed(1)}
            />
            <Tooltip 
              labelFormatter={(label) => `Date: ${label.toLocaleDateString('en-GB')}`} 
              formatter={(value, name) => [Number(value).toFixed(2) + ' m³/s', name]}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
            <RechartsLegend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            {(selectedSeries === 'both' || selectedSeries === 'gfs') && 
              <Line 
                type="monotone" 
                dataKey="gfs" 
                stroke="#1f77b4" 
                name="GFS Model" 
                dot={false} 
                strokeWidth={3}
                activeDot={{ r: 6, stroke: '#1f77b4', strokeWidth: 2, fill: 'white' }}
              />
            }
            {(selectedSeries === 'both' || selectedSeries === 'icon') && 
              <Line 
                type="monotone" 
                dataKey="icon" 
                stroke="#ff7f0e" 
                name="ICON Model" 
                dot={false} 
                strokeWidth={3}
                activeDot={{ r: 6, stroke: '#ff7f0e', strokeWidth: 2, fill: 'white' }}
              />
            }
          </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

// Component to render GeoSFM charts (river depth or streamflow)
export const GeoSFMChart = ({ timeSeriesData, dataType = 'riverdepth', stationName = '' }) => {
  const chartRef = useRef(null);
  
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return <div className="chart-no-data" style={{ padding: '20px', textAlign: 'center' }}>No data available.</div>;
  }

  const yAxisLabel = dataType === 'riverdepth' ? 'River Depth (m)' : 'Streamflow (m³/s)';
  const tooltipLabel = dataType === 'riverdepth' ? 'River Depth' : 'Streamflow';
  const displayUnit = dataType === 'riverdepth' ? 'm' : 'm³/s';
  const dataKey = dataType === 'riverdepth' ? 'depth' : 'streamflow';
  
  // Calculate Y-axis domain for better scaling
  const values = timeSeriesData.map(item => Number(item[dataKey]) || 0).filter(v => !isNaN(v));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [Math.max(0, minValue - padding), maxValue + padding];


  return (
    <div className="chart-container" ref={chartRef}>
      <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 70, bottom: 80 }}>
            <defs>
              <linearGradient id="geosfmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1f77b4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#1f77b4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="timestamp" 
              angle={-45} 
              textAnchor="end" 
              height={100} 
              tickFormatter={(dt) => new Date(dt).toLocaleDateString('en-GB')} 
              minTickGap={50}
              stroke="#666"
              fontSize={12}
            />
            <YAxis 
              domain={yDomain}
              label={{ 
                value: yAxisLabel, 
                angle: -90, 
                position: 'insideLeft', 
                offset: -30, 
                dy: 60, 
                style: { fontSize: '12px', fontWeight: 'bold', fill: '#333' } 
              }} 
              tickFormatter={(value) => Number(value).toFixed(1)}
              stroke="#666"
              fontSize={12}
            />
            <Tooltip 
              labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-GB')}`} 
              formatter={(value) => [`${Number(value).toFixed(2)} ${displayUnit}`, tooltipLabel]}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
            <RechartsLegend 
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={dataType === 'riverdepth' ? '#2196F3' : '#FF6B35'} 
              name={tooltipLabel} 
              dot={false} 
              strokeWidth={3}
              activeDot={{ 
                r: 6, 
                stroke: dataType === 'riverdepth' ? '#2196F3' : '#FF6B35', 
                strokeWidth: 2, 
                fill: 'white' 
              }}
            />
          </LineChart>
        </ResponsiveContainer>
    </div>
  );
};