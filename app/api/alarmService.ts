import { Alarm, AlarmStatus } from '../types/alarm';

// Mock data based on the provided IOT ALARM LIST
const mockAlarms: Alarm[] = [
  {
    id: '1',
    description: 'HARDENING ZONE 1 TEMPERATURE (LOW)',
    type: 'temperature',
    zone: 'zone1',
    severity: 'warning',
    status: 'active',
    value: 845,
    setPoint: 870,
    unit: '°C',
    lowLimit: 850,
    highLimit: 880,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
  },
  {
    id: '2',
    description: 'HARDENING ZONE 2 TEMPERATURE (HIGH)',
    type: 'temperature',
    zone: 'zone2',
    severity: 'critical',
    status: 'active',
    value: 895,
    setPoint: 880,
    unit: '°C',
    lowLimit: 870,
    highLimit: 890,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
  },
  {
    id: '3',
    description: 'CARBON POTENTIAL (CP%)',
    type: 'carbon',
    severity: 'info',
    status: 'acknowledged',
    value: 0.46,
    setPoint: 0.40,
    unit: '%',
    lowLimit: 0.35,
    highLimit: 0.45,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    acknowledgedBy: 'John Doe',
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 minutes ago
  },
  {
    id: '4',
    description: 'OIL TEMPERATURE (HIGH)',
    type: 'oil',
    severity: 'critical',
    status: 'resolved',
    value: 82,
    setPoint: 60,
    unit: '°C',
    highLimit: 80,
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    acknowledgedBy: 'Jane Smith',
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(), // 1h55m ago
    resolvedAt: new Date(Date.now() - 1000 * 60 * 100).toISOString(), // 1h40m ago
  },
  {
    id: '5',
    description: 'HARDENING CONVEYOR (NOT ROTATING)',
    type: 'conveyor',
    severity: 'critical',
    status: 'active',
    value: 'Stopped',
    setPoint: 'Running',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 minutes ago
  },
  {
    id: '6',
    description: 'HARDENING FAN MOTOR NOT RUNNING (ZONE1)',
    type: 'fan',
    zone: 'zone1',
    severity: 'warning',
    status: 'active',
    value: 'Stopped',
    setPoint: 'Running',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
  },
  {
    id: '7',
    description: 'TEMPERING ZONE1 TEMPERATURE (LOW)',
    type: 'temperature',
    zone: 'zone1',
    severity: 'warning',
    status: 'active',
    value: 415,
    setPoint: 450,
    unit: '°C',
    lowLimit: 420,
    highLimit: 460,
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(), // 8 minutes ago
  },
];

// API service for alarms
export const alarmService = {
  // Fetch all alarms
  fetchAlarms: async (): Promise<Alarm[]> => {
    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockAlarms;
  },

  // Fetch active alarms
  fetchActiveAlarms: async (): Promise<Alarm[]> => {
    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockAlarms.filter(alarm => alarm.status === 'active');
  },

  // Update alarm status
  updateAlarmStatus: async (id: string, status: AlarmStatus): Promise<Alarm> => {
    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const alarm = mockAlarms.find(a => a.id === id);
    if (!alarm) {
      throw new Error('Alarm not found');
    }
    
    const updatedAlarm: Alarm = {
      ...alarm,
      status,
      acknowledgedAt: status === 'acknowledged' ? new Date().toISOString() : alarm.acknowledgedAt,
      resolvedAt: status === 'resolved' ? new Date().toISOString() : alarm.resolvedAt,
    };
    
    // Update in mock data (just for demo)
    const index = mockAlarms.findIndex(a => a.id === id);
    if (index !== -1) {
      mockAlarms[index] = updatedAlarm;
    }
    
    return updatedAlarm;
  },
  
  // Fetch alarm history
  fetchAlarmHistory: async (timeframe: number = 24): Promise<Alarm[]> => {
    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Return all alarms as history (in a real app, this would fetch from a history endpoint)
    return mockAlarms.slice().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },
}; 