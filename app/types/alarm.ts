export type AlarmSeverity = 'critical' | 'warning' | 'info';

export type AlarmType = 
  | 'temperature' 
  | 'level' 
  | 'pressure' 
  | 'motor' 
  | 'conveyor' 
  | 'fan' 
  | 'heater' 
  | 'carbon' 
  | 'oil';

export type Zone = 'zone1' | 'zone2';

export type AlarmStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlarmThreshold {
  id: string;
  type: AlarmType;
  zone?: Zone;
  setPoint: number | string;
  lowLimit?: number;
  highLimit?: number;
  unit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alarm {
  id: string;
  description: string;
  type: AlarmType;
  zone?: Zone;
  severity: AlarmSeverity;
  status: AlarmStatus;
  value: number | string;
  setPoint: number | string;
  unit?: string;
  lowLimit?: number;
  highLimit?: number;
  timestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlarmHistory {
  id: string;
  alarmId: string;
  description: string;
  type: AlarmType;
  severity: AlarmSeverity;
  status: AlarmStatus;
  value: number | string;
  setPoint: number | string;
  timestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
} 