import { create } from 'zustand';
import { Alarm, AlarmStatus } from '../types/alarm';

interface AlarmState {
  alarms: Alarm[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  setAlarms: (alarms: Alarm[]) => void;
  updateAlarmStatus: (id: string, status: AlarmStatus) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getAlarmsByType: (type: 'analog' | 'binary') => Alarm[];
  getAlarmsBySeverity: (severity: 'critical' | 'warning' | 'info' | 'all') => Alarm[];
  clearError: () => void;
}

// Create a Zustand store for managing alarms
export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  setAlarms: (alarms) => set({ 
    alarms,
    lastUpdated: new Date(),
    error: null 
  }),
  
  updateAlarmStatus: (id, status) => 
    set((state) => ({
      alarms: state.alarms.map((alarm) => 
        alarm.id === id 
          ? {
              ...alarm, 
              status,
              acknowledgedAt: status === 'acknowledged' ? new Date().toISOString() : alarm.acknowledgedAt,
              resolvedAt: status === 'resolved' ? new Date().toISOString() : alarm.resolvedAt,
            } 
          : alarm
      )
    })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  getAlarmsByType: (type) => {
    const state = get();
    if (type === 'analog') {
      return state.alarms.filter(alarm => 
        alarm.alarmType === 'analog' || 
        ['temperature', 'carbon', 'pressure'].includes(alarm.type.toLowerCase())
      );
    }
    return state.alarms.filter(alarm => 
      alarm.alarmType === 'binary' ||
      ['fan', 'heater', 'level'].includes(alarm.type.toLowerCase())
    );
  },

  getAlarmsBySeverity: (severity) => {
    const state = get();
    if (severity === 'all') return state.alarms;
    return state.alarms.filter(alarm => alarm.severity === severity);
  },
})); 