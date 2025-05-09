// Define extended Alarm type
export interface Alarm {
  id: string;
  description: string;
  type: string;
  zone?: string | null;
  severity: string;
  status: string;
  value: string;
  setPoint: string;
  unit?: string | null;
  lowLimit?: number | null;
  highLimit?: number | null;
  timestamp: Date;
  acknowledgedById?: string | null;
  acknowledgedBy?: User | null;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  history?: AlarmHistory[];
  notifications?: Notification[];
}

// Define extended AlarmHistory type
export interface AlarmHistory {
  id: string;
  alarmId: string;
  alarm?: Alarm;
  description: string;
  type: string;
  severity: string;
  status: string;
  value: string;
  setPoint: string;
  timestamp: Date;
  acknowledgedById?: string | null;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
}

// Define extended User type
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAlarms?: Alarm[];
  notifications?: Notification[];
  pushToken?: string | null;
  notificationSettings?: NotificationSettings | null;
}

// Define extended Notification type
export interface Notification {
  id: string;
  userId: string;
  user?: User;
  title: string;
  body: string;
  type: string;
  priority: string;
  isRead: boolean;
  relatedAlarmId?: string | null;
  relatedAlarm?: Alarm | null;
  createdAt: Date;
  readAt?: Date | null;
}

// Define extended NotificationSettings type
export interface NotificationSettings {
  id: string;
  userId: string;
  user?: User;
  pushEnabled: boolean;
  emailEnabled: boolean;
  criticalOnly: boolean;
  muteFrom?: number | null;
  muteTo?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Define enum types for convenience
export const AlarmSeverity = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export const AlarmStatus = {
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED'
};

export const AlarmType = {
  TEMPERATURE: 'TEMPERATURE',
  LEVEL: 'LEVEL',
  PRESSURE: 'PRESSURE',
  MOTOR: 'MOTOR',
  CONVEYOR: 'CONVEYOR',
  FAN: 'FAN',
  HEATER: 'HEATER',
  CARBON: 'CARBON',
  OIL: 'OIL'
};

export const NotificationType = {
  ALARM: 'ALARM',
  SYSTEM: 'SYSTEM',
  MAINTENANCE: 'MAINTENANCE',
  INFO: 'INFO'
};

export const NotificationPriority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
}; 