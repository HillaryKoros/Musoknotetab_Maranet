import React, { useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RechartsLegend, ResponsiveContainer, ReferenceLine } from 'recharts';

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
export const DischargeChart = ({ timeSeriesData, selectedSeries = 'both', stationName = '', onSeriesChange, height = 300 }) => {
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
  
  // Log first data point to see date format
  if (processedData.length > 0) {
    console.log("First data point:", processedData[0].time, "Type:", typeof processedData[0].time);
  }

  // Calculate Y-axis domain for better scaling
  const allValues = processedData.flatMap(item => [item.gfs, item.icon].filter(v => v != null && !isNaN(v)));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue;
  
  // Adjust padding based on the range to ensure visibility of small differences
  let padding;
  if (range < 0.1) {
    padding = range * 0.5; // 50% padding for very small ranges
  } else if (range < 1) {
    padding = range * 0.3; // 30% padding for small ranges
  } else {
    padding = range * 0.1; // 10% padding for normal ranges
  }
  
  // Ensure minimum visible range
  const minRange = 0.05;
  let yDomain;
  if (range < minRange) {
    const center = (minValue + maxValue) / 2;
    const adjustedMin = center - minRange / 2;
    const adjustedMax = center + minRange / 2;
    yDomain = [Math.max(0, adjustedMin), adjustedMax];
  } else {
    yDomain = [Math.max(0, minValue - padding), maxValue + padding];
  }

  // Calculate appropriate tick values to avoid duplicates
  const calculateTicks = (domain) => {
    const [min, max] = domain;
    const range = max - min;
    let targetTickCount = 5;
    
    // For very small ranges, reduce tick count to avoid crowding
    if (range < 0.1) targetTickCount = 4;
    if (range < 0.05) targetTickCount = 3;
    
    // Calculate the step size
    let step = range / (targetTickCount - 1);
    
    // Determine the precision needed based on the step size
    let precision = 0;
    if (step < 0.001) precision = 4;
    else if (step < 0.01) precision = 3;
    else if (step < 0.1) precision = 2;
    else if (step < 1) precision = 1;
    
    // Round step to avoid floating point issues
    const factor = Math.pow(10, precision);
    step = Math.ceil(step * factor) / factor;
    
    // Generate ticks starting from a rounded minimum
    const ticks = [];
    const roundedMin = Math.floor(min * factor) / factor;
    
    for (let i = 0; i < targetTickCount; i++) {
      const tickValue = roundedMin + (i * step);
      if (tickValue <= max) {
        // Round to avoid floating point precision issues
        const roundedTick = Math.round(tickValue * factor) / factor;
        ticks.push(roundedTick);
      }
    }
    
    // Remove any duplicates (this handles edge cases)
    const uniqueTicks = [...new Set(ticks.map(t => t.toFixed(precision)))].map(Number);
    
    // Ensure we have at least 2 ticks
    if (uniqueTicks.length < 2) {
      return [min, max];
    }
    
    return uniqueTicks;
  };

  const yTicks = calculateTicks(yDomain);

  // Get current date for reference line - July 13, 2025
  const currentDate = new Date(2025, 6, 13, 12, 0, 0); // Month is 0-indexed, so 6 = July, set to noon
  
  // Find the closest data point to today for better alignment
  let closestDataPoint = null;
  if (processedData.length > 0) {
    closestDataPoint = processedData.reduce((prev, curr) => {
      return Math.abs(curr.time - currentDate) < Math.abs(prev.time - currentDate) ? curr : prev;
    });
  }
  
  console.log("Processed chart data:", processedData.length, "points");
  console.log("Current date for reference line:", currentDate);
  console.log("Closest data point:", closestDataPoint);


  return (
    <div className="chart-container" ref={chartRef}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={processedData} margin={{ top: 25, right: 20, left: 50, bottom: 60 }}>
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
              height={60} 
              tickFormatter={(dt) => {
                const date = new Date(dt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              }} 
              minTickGap={40}
              stroke="#666"
              fontSize={10}
            />
            <YAxis 
              domain={yDomain}
              ticks={yTicks}
              label={{ 
                value: 'Discharge (m³/s)', 
                angle: -90, 
                position: 'insideLeft', 
                offset: 15, 
                style: { textAnchor: 'middle', fontSize: '13px', fill: '#333' } 
              }}
              stroke="#666"
              fontSize={11}
              tickFormatter={(value) => {
                const num = Number(value);
                if (isNaN(num)) return '0';
                
                // Format based on the value size
                if (num >= 1000) {
                  return (num / 1000).toFixed(1) + 'k';
                } else if (num >= 100) {
                  return num.toFixed(0);
                } else if (num >= 10) {
                  // For values 10-99, show integer if whole number, otherwise 1 decimal
                  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
                } else if (num >= 1) {
                  // For values 1-10, show appropriate decimals
                  if (num % 1 === 0) return num.toFixed(0);
                  if ((num * 10) % 1 === 0) return num.toFixed(1);
                  return num.toFixed(2);
                } else if (num > 0) {
                  // For values less than 1
                  if (num >= 0.1) return num.toFixed(2);
                  if (num >= 0.01) return num.toFixed(3);
                  return num.toFixed(4);
                } else {
                  return '0';
                }
              }}
              width={60}
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
            {closestDataPoint && (
              <ReferenceLine 
                x={closestDataPoint.time} 
                stroke="#666666" 
                strokeWidth={1.5}
                strokeDasharray="8 4"
                label={{ 
                  value: "Current Date", 
                  position: "insideTop",
                  offset: 15,
                  fill: "#333333",
                  fontSize: 11,
                  fontWeight: 600
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

// Component to render GeoSFM charts (river depth or streamflow)
export const GeoSFMChart = ({ timeSeriesData, dataType = 'riverdepth', stationName = '', height = 300 }) => {
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
      <ResponsiveContainer width="100%" height={height}>
          <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 50, bottom: 60 }}>
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
              height={60} 
              tickFormatter={(dt) => {
                const date = new Date(dt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              }} 
              minTickGap={40}
              stroke="#666"
              fontSize={10}
            />
            <YAxis 
              domain={yDomain}
              label={{ 
                value: yAxisLabel, 
                angle: -90, 
                position: 'insideLeft', 
                offset: 15, 
                style: { textAnchor: 'middle', fontSize: '13px', fill: '#333' } 
              }} 
              tickFormatter={(value) => {
                const num = Number(value);
                if (dataType === 'riverdepth') {
                  return num.toFixed(2);
                } else {
                  if (num >= 1000) {
                    return (num / 1000).toFixed(1) + 'k';
                  } else if (num >= 100) {
                    return num.toFixed(0);
                  } else {
                    return num.toFixed(1);
                  }
                }
              }}
              width={60}
              stroke="#666"
              fontSize={11}
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