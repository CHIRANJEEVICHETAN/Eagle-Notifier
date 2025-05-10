import { format as formatDate } from 'date-fns';
import { ReportData } from '../api/reportsApi';
import { ReportTimeRange } from '../components/ReportGenerator';

/**
 * Generates HTML content for a PDF report
 */
export function generateReportHtml(
  reportData: ReportData,
  timeRange: ReportTimeRange,
  title: string = 'Eagle Alarm Report'
): string {
  const { alarms, analytics, timeSeriesData } = reportData;
  
  // Format date ranges for display
  const startDate = formatDate(new Date(timeRange.startDate), 'PPP p');
  const endDate = formatDate(new Date(timeRange.endDate), 'PPP p');
  
  // Create alarm type color mapping
  const typeColors: Record<string, string> = {
    temperature: '#EF4444', // red
    carbon: '#F59E0B',      // amber
    oil: '#3B82F6',         // blue
    conveyor: '#10B981',    // emerald
    fan: '#8B5CF6',         // violet
    heater: '#EC4899',      // pink
    level: '#6366F1',       // indigo
    pressure: '#F97316',    // orange
    motor: '#14B8A6',       // teal
  };
  
  // Create severity color mapping
  const severityColors: Record<string, string> = {
    critical: '#DC2626', // red-600
    warning: '#F59E0B',  // amber-500
    info: '#3B82F6',     // blue-500
  };
  
  // Generate table rows for alarms
  const alarmRows = alarms.map(alarm => {
    const statusBadge = getStatusBadge(alarm.status);
    const severityBadge = getSeverityBadge(alarm.severity);
    
    return `
      <tr>
        <td>${formatDate(new Date(alarm.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
        <td>${alarm.description}</td>
        <td>${alarm.type}</td>
        <td>${severityBadge}</td>
        <td>${statusBadge}</td>
        <td>${alarm.value} ${alarm.setPoint ? `/ ${alarm.setPoint}` : ''}</td>
        <td>${alarm.acknowledgedAt ? formatDate(new Date(alarm.acknowledgedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}</td>
      </tr>
    `;
  }).join('');
  
  // Generate analytics HTML
  const analyticsHtml = `
    <div class="analytics-section">
      <div class="analytics-row">
        <div class="analytics-box">
          <h3>Total Alarms</h3>
          <div class="analytics-value">${analytics.totalAlarms}</div>
        </div>
        <div class="analytics-box">
          <h3>Avg. Response Time</h3>
          <div class="analytics-value">${analytics.averageResponseTime.toFixed(1)} min</div>
        </div>
      </div>
      
      <div class="analytics-row">
        <div class="analytics-box">
          <h3>By Type</h3>
          <div class="analytics-chart">
            ${generateDivBarChart(analytics.byType, typeColors)}
          </div>
        </div>
        <div class="analytics-box">
          <h3>By Severity</h3>
          <div class="analytics-chart">
            ${generateDivBarChart(analytics.bySeverity, severityColors)}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Generate time series chart
  const timeSeriesHtml = `
    <div class="time-series-section">
      <h2>Alarm Activity Over Time</h2>
      <div class="time-series-chart">
        ${generateTimeSeriesChart(timeSeriesData, typeColors)}
      </div>
    </div>
  `;
  
  // Generate the full HTML document
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #1F2937;
          }
          
          .report-header {
            text-align: center;
            margin-bottom: 30px;
          }
          
          .report-title {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            color: #111827;
          }
          
          .report-period {
            font-size: 16px;
            color: #6B7280;
            margin: 5px 0 0 0;
          }
          
          .report-timestamp {
            font-size: 12px;
            color: #9CA3AF;
            margin: 5px 0 0 0;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          
          th {
            background-color: #F3F4F6;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #E5E7EB;
          }
          
          td {
            padding: 10px;
            border: 1px solid #E5E7EB;
            font-size: 12px;
          }
          
          .status-badge, .severity-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          
          .status-active {
            background-color: #FEF2F2;
            color: #DC2626;
          }
          
          .status-acknowledged {
            background-color: #FFF7ED;
            color: #C2410C;
          }
          
          .status-resolved {
            background-color: #ECFDF5;
            color: #059669;
          }
          
          .severity-critical {
            background-color: #FEF2F2;
            color: #DC2626;
          }
          
          .severity-warning {
            background-color: #FFFBEB;
            color: #D97706;
          }
          
          .severity-info {
            background-color: #EFF6FF;
            color: #2563EB;
          }
          
          .section-title {
            font-size: 18px;
            margin: 30px 0 15px 0;
            color: #111827;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 5px;
          }
          
          .analytics-section {
            margin: 30px 0;
          }
          
          .analytics-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          
          .analytics-box {
            width: 48%;
            padding: 15px;
            border-radius: 8px;
            background-color: #F9FAFB;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .analytics-box h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #4B5563;
          }
          
          .analytics-value {
            font-size: 28px;
            font-weight: bold;
            color: #111827;
          }
          
          .analytics-chart {
            margin-top: 15px;
          }
          
          .bar-container {
            height: 20px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
          }
          
          .bar-label {
            width: 85px;
            font-size: 12px;
            text-align: right;
            padding-right: 10px;
          }
          
          .bar {
            height: 16px;
            border-radius: 3px;
          }
          
          .bar-value {
            margin-left: 8px;
            font-size: 12px;
            font-weight: bold;
          }
          
          .time-series-section {
            margin: 30px 0;
          }
          
          .time-series-chart {
            background-color: #F9FAFB;
            border-radius: 8px;
            padding: 15px;
            height: 200px;
            position: relative;
            margin-top: 15px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .time-point {
            position: absolute;
            bottom: 30px;
            width: 4px;
            transform: translateX(-50%);
          }
          
          .time-label {
            position: absolute;
            bottom: 5px;
            font-size: 10px;
            transform: translateX(-50%);
            white-space: nowrap;
          }
          
          .time-bar {
            position: absolute;
            width: 12px;
            bottom: 30px;
            border-radius: 2px 2px 0 0;
          }
          
          .legend {
            display: flex;
            flex-wrap: wrap;
            margin-top: 15px;
          }
          
          .legend-item {
            display: flex;
            align-items: center;
            margin-right: 15px;
            margin-bottom: 5px;
          }
          
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            margin-right: 5px;
          }
          
          .legend-label {
            font-size: 11px;
          }
          
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #9CA3AF;
            padding-top: 15px;
            border-top: 1px solid #E5E7EB;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1 class="report-title">${title}</h1>
          <p class="report-period">Period: ${startDate} to ${endDate}</p>
          <p class="report-timestamp">Generated on: ${formatDate(new Date(), 'PPP p')}</p>
        </div>
        
        <h2 class="section-title">Analytics Overview</h2>
        ${analyticsHtml}
        
        ${timeSeriesHtml}
        
        <h2 class="section-title">Alarm Details</h2>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Description</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Value/SetPoint</th>
              <th>Acknowledged At</th>
            </tr>
          </thead>
          <tbody>
            ${alarmRows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Eagle Notifier | Generated by Eagle Notifier App</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Helper function to generate a badge for alarm status
 */
function getStatusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return '<span class="status-badge status-active">Active</span>';
    case 'acknowledged':
      return '<span class="status-badge status-acknowledged">Acknowledged</span>';
    case 'resolved':
      return '<span class="status-badge status-resolved">Resolved</span>';
    default:
      return status;
  }
}

/**
 * Helper function to generate a badge for alarm severity
 */
function getSeverityBadge(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '<span class="severity-badge severity-critical">Critical</span>';
    case 'warning':
      return '<span class="severity-badge severity-warning">Warning</span>';
    case 'info':
      return '<span class="severity-badge severity-info">Info</span>';
    default:
      return severity;
  }
}

/**
 * Helper function to generate a div-based bar chart
 */
function generateDivBarChart(
  data: Record<string, number>,
  colorMap: Record<string, string>
): string {
  if (Object.keys(data).length === 0) {
    return '<div class="empty-chart">No data available</div>';
  }
  
  // Find the maximum value for scaling
  const maxValue = Math.max(...Object.values(data));
  
  // Generate bars
  const bars = Object.entries(data).map(([key, value]) => {
    const percentage = (value / maxValue) * 100;
    const color = colorMap[key.toLowerCase()] || '#CBD5E1'; // default to slate-300
    
    return `
      <div class="bar-container">
        <div class="bar-label">${key}</div>
        <div class="bar" style="width: ${percentage}%; background-color: ${color};"></div>
        <div class="bar-value">${value}</div>
      </div>
    `;
  }).join('');
  
  return bars;
}

/**
 * Helper function to generate a simple time series chart
 */
function generateTimeSeriesChart(
  timeSeriesData: ReportData['timeSeriesData'],
  colorMap: Record<string, string>
): string {
  if (timeSeriesData.length === 0) {
    return '<div class="empty-chart">No data available</div>';
  }
  
  // Get all unique types
  const types = new Set<string>();
  timeSeriesData.forEach(point => {
    Object.keys(point.values).forEach(type => types.add(type));
  });
  
  // Create a legend
  const legend = Array.from(types).map(type => {
    const color = colorMap[type.toLowerCase()] || '#CBD5E1';
    return `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${color};"></div>
        <div class="legend-label">${type}</div>
      </div>
    `;
  }).join('');
  
  // Calculate the width of each time point
  const width = 100 / (timeSeriesData.length || 1);
  
  // Generate the time points
  const timePoints = timeSeriesData.map((point, index) => {
    const left = (index / (timeSeriesData.length - 1)) * 100;
    const formattedDate = formatDate(new Date(point.timestamp), 'MM/dd HH:mm');
    
    // Generate bars for each type
    const bars = Array.from(types).map((type, typeIndex) => {
      const value = Number(point.values[type]) || 0;
      if (value === 0) return '';
      
      const color = colorMap[type.toLowerCase()] || '#CBD5E1';
      const height = value * 10; // Scale factor for height
      const typeOffset = typeIndex * 14; // Offset each type
      
      return `
        <div class="time-bar" style="
          height: ${height}px;
          background-color: ${color};
          left: ${left + typeOffset}%;
        "></div>
      `;
    }).join('');
    
    return `
      <div class="time-point" style="left: ${left}%;">
        ${bars}
        <div class="time-label">${formattedDate}</div>
      </div>
    `;
  }).join('');
  
  return `
    ${timePoints}
    <div class="legend">
      ${legend}
    </div>
  `;
} 