export type NotificationType = 'ALARM' | 'SYSTEM' | 'MAINTENANCE' | 'INFO' | 'PREDICTIVE';
export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  relatedAlarmId?: string;
  relatedAlarm?: {
    id: string;
    type: string;
    severity: string;
    status: string;
    value: string;
    unit?: string;
  };
  createdAt: string;
  readAt?: string;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  criticalOnly: boolean;
  muteFrom?: number;
  muteTo?: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
} 