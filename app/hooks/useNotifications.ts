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
import { useAuth } from '../context/AuthContext';

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
  const { organizationId, authState } = useAuth();
  const enabled = authState.isAuthenticated && !!authState.user;
  return useInfiniteQuery({
    queryKey: [NOTIFICATIONS_KEY, filter, limit, source],
    queryFn: ({ pageParam = 1 }) => fetchNotifications(pageParam as number, limit, filter, source, organizationId ?? undefined),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled,
  });
};

/**
 * Hook for fetching unread notifications count
 */
export const useUnreadCount = () => {
  const { organizationId, authState } = useAuth();
  const enabled = authState.isAuthenticated && !!authState.user;
  return useQuery({
    queryKey: [UNREAD_COUNT_KEY],
    queryFn: () => fetchUnreadCount(organizationId ?? undefined),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    refetchOnWindowFocus: true, // Refetch when app comes into focus
    refetchOnMount: true, // Always refetch on mount
    enabled,
  });
};

/**
 * Hook for marking a notification as read
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId, organizationId ?? undefined),
    onSuccess: (updatedNotification) => {
      // Invalidate notifications cache to refetch with updated data
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
      
      // Optimistically update the unread count
      queryClient.setQueryData([UNREAD_COUNT_KEY], (old: number | undefined) => {
        return Math.max(0, (old || 0) - 1);
      });
    }
  });
};

/**
 * Hook for marking all notifications as read
 */
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  
  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(organizationId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
      
      // Optimistically update the unread count to 0
      queryClient.setQueryData([UNREAD_COUNT_KEY], 0);
    }
  });
};

/**
 * Hook for deleting a notification
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  
  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId, organizationId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY] });
      
      // Force refetch of unread count since we don't know if deleted notification was read/unread
      queryClient.refetchQueries({ queryKey: [UNREAD_COUNT_KEY] });
    }
  });
};

/**
 * Hook for updating notification settings
 */
export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  
  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) => updateNotificationSettings(settings, organizationId ?? undefined),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData([SETTINGS_KEY], updatedSettings);
    }
  });
}; 