import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../api/notificationsApi';
import { useTheme } from '../context/ThemeContext';

interface NotificationBadgeProps {
  size?: 'small' | 'medium' | 'large';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ size = 'medium' }) => {
  const { isDarkMode } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Query unread notifications count
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'unread', 'count'],
    queryFn: () => fetchNotifications(1, 1, 'unread'),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
  
  // Update unread count when data changes
  useEffect(() => {
    if (data && !isLoading) {
      setUnreadCount(data.pagination.total);
    }
  }, [data, isLoading]);
  
  // Don't render anything if there are no unread notifications
  if (unreadCount === 0) return null;
  
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
        {unreadCount > 99 ? '99+' : unreadCount}
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