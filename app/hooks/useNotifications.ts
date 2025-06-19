import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  updateNotificationSettings,
  fetchUnreadCount
} from '../api/notificationsApi';
import { NotificationSettings } from '../types/notification';

// Query keys
const NOTIFICATIONS_KEY = 'notifications';
const SETTINGS_KEY = 'notificationSettings';
const UNREAD_COUNT_KEY = 'unreadCount';

/**
 * Hook for fetching notifications with pagination and infinite loading
 */
export const useNotifications = (
  filter: 'all' | 'unread' = 'all', 
  limit: number = 10,
  source?: string
) => {
  return useInfiniteQuery({
    queryKey: [NOTIFICATIONS_KEY, filter, limit, source],
    queryFn: ({ pageParam = 1 }) => fetchNotifications(pageParam as number, limit, filter, source),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Hook for fetching unread notifications count
 */
export const useUnreadCount = () => {
  return useQuery({
    queryKey: [UNREAD_COUNT_KEY],
    queryFn: fetchUnreadCount,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Hook for marking a notification as read
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (updatedNotification) => {
      // Invalidate notifications cache to refetch with updated data
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
    }
  });
};

/**
 * Hook for marking all notifications as read
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
    }
  });
};

/**
 * Hook for deleting a notification
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
    }
  });
};

/**
 * Hook for updating notification settings
 */
export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) => updateNotificationSettings(settings),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData([SETTINGS_KEY], updatedSettings);
    }
  });
}; 