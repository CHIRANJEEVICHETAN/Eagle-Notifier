import { create } from 'zustand';
import { Alarm, AlarmStatus } from '../types/alarm';

interface AlarmState {
  alarms: Alarm[];
  isLoading: boolean;
  error: string | null;
  setAlarms: (alarms: Alarm[]) => void;
  addAlarm: (alarm: Alarm) => void;
  updateAlarmStatus: (id: string, status: AlarmStatus) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

// Create a Zustand store for managing alarms
export const useAlarmStore = create<AlarmState>((set) => ({
  alarms: [],
  isLoading: false,
  error: null,

  setAlarms: (alarms) => set({ alarms }),
  
  addAlarm: (alarm) => 
    set((state) => ({
      alarms: [alarm, ...state.alarms]
    })),
  
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
})); 