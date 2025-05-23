import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../api/notificationsApi';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../NotificationProvider';

interface NotificationBadgeProps {
  size?: 'small' | 'medium' | 'large';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ size = 'medium' }) => {
  const { isDarkMode } = useTheme();
  const { notificationCount } = useNotification();
  const [displayCount, setDisplayCount] = useState(0);
  
  // Query unread notifications count
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'unread', 'count'],
    queryFn: () => fetchNotifications(1, 1, 'unread'),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
  
  // Update display count when either notificationCount or data changes
  useEffect(() => {
    if (data?.pagination?.total !== undefined) {
      setDisplayCount(Math.max(data.pagination.total, notificationCount));
    } else if (!isLoading) {
      setDisplayCount(notificationCount);
    }
  }, [data, notificationCount, isLoading]);
  
  // Don't render anything if there are no unread notifications
  if (displayCount === 0) return null;
  
  // Determine badge size
  const badgeSize = {
    small: { width: 16, height: 16, fontSize: 10 },
    medium: { width: 20, height: 20, fontSize: 12 },
    large: { width: 24, height: 24, fontSize: 14 },
  }[size];
  
  return (
    <View style={[
      styles.badge,
      {
        width: badgeSize.width,
        height: badgeSize.height,
        backgroundColor: isDarkMode ? '#EF4444' : '#F87171',
      }
    ]}>
      <Text style={[
        styles.badgeText,
        { fontSize: badgeSize.fontSize }
      ]}>
        {displayCount > 99 ? '99+' : displayCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default NotificationBadge; 