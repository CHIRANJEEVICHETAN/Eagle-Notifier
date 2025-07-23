export type User = {
  id: string;
  name: string;
  email: string;
};

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
  | 'oil'
  | 'predictive';

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
  type: string;
  zone?: string;
  severity: 'critical' | 'warning' | 'info';
  status: AlarmStatus;
  value: string;
  setPoint: string;
  unit?: string;
  lowLimit?: string;
  highLimit?: string;
  timestamp: string;
  acknowledgedBy?: {
    id: string;
    name: string;
  };
  acknowledgedAt?: string;
  resolvedBy?: {
    id: string;
    name: string;
  };
  resolvedAt?: string;
  resolutionMessage?: string;
  alarmType?: 'analog' | 'binary' | 'predictive';
  // Predictive alert specific fields
  confidence?: number;
  timeToFailure?: number;
  predictedComponent?: string;
  modelVersion?: string;
  isAccurate?: boolean;
  feedbackAt?: string;
  feedbackBy?: string;
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