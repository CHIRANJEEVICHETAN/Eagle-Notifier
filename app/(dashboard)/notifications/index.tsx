import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { 
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification
} from '../../hooks/useNotifications';
import { Notification } from '../../types/notification';

export default function NotificationsScreen() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // TanStack Query hooks
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useNotifications(filter);
  
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();
  
  // Flatten the pages of notifications
  const notifications = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap(page => page.notifications);
  }, [data]);
  
  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    if (!notifications.length) return {};
    
    return notifications.reduce((groups: Record<string, Notification[]>, notification) => {
      const date = new Date(notification.createdAt);
      let groupKey = '';
      
      if (isToday(date)) {
        groupKey = 'Today';
      } else if (isYesterday(date)) {
        groupKey = 'Yesterday';
      } else if (isThisWeek(date)) {
        groupKey = 'This Week';
      } else {
        groupKey = 'Earlier';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(notification);
      return groups;
    }, {});
  }, [notifications]);
  
  // Convert grouped notifications to format suitable for FlashList
  const sections = useMemo(() => {
    return Object.entries(groupedNotifications).map(([title, items]) => ({
      title,
      data: items
    }));
  }, [groupedNotifications]);
  
  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  
  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  
  // Handle mark as read
  const handleMarkAsRead = useCallback((notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  }, [markAsReadMutation]);
  
  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);
  
  // Handle delete notification
  const handleDeleteNotification = useCallback((notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  }, [deleteNotificationMutation]);
  
  // Render notification item
  const renderNotificationItem = useCallback(({ item }: { item: Notification }) => {
    const priorityColors = {
      HIGH: isDarkMode ? '#EF4444' : '#F87171',
      MEDIUM: isDarkMode ? '#F59E0B' : '#FBBF24',
      LOW: isDarkMode ? '#10B981' : '#34D399',
    };
    
    const typeIcons = {
      ALARM: 'alarm-outline',
      SYSTEM: 'desktop-outline',
      MAINTENANCE: 'construct-outline',
      INFO: 'information-circle-outline',
    };
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { 
            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            opacity: item.isRead ? 0.8 : 1
          }
        ]}
        onPress={() => {
          if (!item.isRead) {
            handleMarkAsRead(item.id);
          }
          
          // Navigate to alarm details if there's a related alarm
          if (item.relatedAlarmId) {
            router.push({
              pathname: '/(dashboard)/alarms/[id]',
              params: { id: item.relatedAlarmId }
            } as any);
          }
        }}
      >
        {/* Priority indicator */}
        <View
          style={[
            styles.priorityIndicator,
            { backgroundColor: priorityColors[item.priority] }
          ]}
        />
        
        {/* Notification content */}
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={typeIcons[item.type] as any}
                size={20}
                color={isDarkMode ? '#60A5FA' : '#2563EB'}
              />
            </View>
            
            <Text style={[
              styles.notificationTitle,
              { 
                color: isDarkMode ? '#FFFFFF' : '#1F2937',
                fontWeight: item.isRead ? '400' : '600'
              }
            ]}>
              {item.title}
            </Text>
            
            {!item.isRead && (
              <View style={[
                styles.unreadBadge,
                { backgroundColor: isDarkMode ? '#3B82F6' : '#60A5FA' }
              ]} />
            )}
          </View>
          
          <Text style={[
            styles.notificationBody,
            { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
          ]}>
            {item.body}
          </Text>
          
          <View style={styles.notificationFooter}>
            <Text style={[
              styles.notificationTimestamp,
              { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
            ]}>
              {format(new Date(item.createdAt), 'MMM d, h:mm a')}
            </Text>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(item.id)}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isDarkMode, handleMarkAsRead, handleDeleteNotification, router]);
  
  // Render section header
  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={[
      styles.sectionHeader,
      { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }
    ]}>
      <Text style={[
        styles.sectionTitle,
        { color: isDarkMode ? '#E5E7EB' : '#4B5563' }
      ]}>
        {section.title}
      </Text>
    </View>
  ), [isDarkMode]);
  
  // Render empty component
  const renderEmptyComponent = useCallback(() => {
    if (isLoading) return null;
    
    return (
      <View style={[
        styles.emptyContainer,
        { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
      ]}>
        <Ionicons
          name="notifications-off-outline"
          size={48}
          color={isDarkMode ? '#9CA3AF' : '#6B7280'}
        />
        <Text style={[
          styles.emptyTitle,
          { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
        ]}>
          No notifications
        </Text>
        <Text style={[
          styles.emptySubtitle,
          { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
        ]}>
          {filter === 'unread' 
            ? 'You have no unread notifications' 
            : 'You have no notifications yet'}
        </Text>
      </View>
    );
  }, [isLoading, isDarkMode, filter]);
  
  // Render footer component
  const renderFooterComponent = useCallback(() => {
    if (!hasNextPage) return null;
    
    return (
      <View style={styles.footer}>
        {isFetchingNextPage ? (
          <ActivityIndicator
            size="small"
            color={isDarkMode ? '#60A5FA' : '#3B82F6'}
          />
        ) : null}
      </View>
    );
  }, [hasNextPage, isFetchingNextPage, isDarkMode]);
  
  // Filter buttons
  const renderFilterButtons = useCallback(() => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          filter === 'all' && styles.filterButtonActive,
          { 
            backgroundColor: isDarkMode 
              ? filter === 'all' ? '#3B82F6' : '#374151' 
              : filter === 'all' ? '#2563EB' : '#F3F4F6'
          }
        ]}
        onPress={() => setFilter('all')}
      >
        <Text style={[
          styles.filterButtonText,
          { 
            color: isDarkMode
              ? filter === 'all' ? '#FFFFFF' : '#E5E7EB'
              : filter === 'all' ? '#FFFFFF' : '#4B5563'
          }
        ]}>
          All
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.filterButton,
          filter === 'unread' && styles.filterButtonActive,
          { 
            backgroundColor: isDarkMode 
              ? filter === 'unread' ? '#3B82F6' : '#374151'
              : filter === 'unread' ? '#2563EB' : '#F3F4F6'
          }
        ]}
        onPress={() => setFilter('unread')}
      >
        <Text style={[
          styles.filterButtonText,
          { 
            color: isDarkMode
              ? filter === 'unread' ? '#FFFFFF' : '#E5E7EB'
              : filter === 'unread' ? '#FFFFFF' : '#4B5563'
          }
        ]}>
          Unread
        </Text>
      </TouchableOpacity>
      
      <View style={{ flex: 1 }} />
      
      <TouchableOpacity
        style={[
          styles.markAllButton,
          { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }
        ]}
        onPress={handleMarkAllAsRead}
        disabled={markAllAsReadMutation.isPending}
      >
        {markAllAsReadMutation.isPending ? (
          <ActivityIndicator size="small" color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
        ) : (
          <>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
            <Text style={[
              styles.markAllButtonText,
              { color: isDarkMode ? '#60A5FA' : '#3B82F6' }
            ]}>
              Mark all as read
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  ), [filter, isDarkMode, handleMarkAllAsRead, markAllAsReadMutation.isPending]);
  
  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB' }
    ]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={isDarkMode ? '#E5E7EB' : '#4B5563'}
          />
        </TouchableOpacity>
        
        <View>
          <Text style={[
            styles.headerTitle,
            { color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            Notifications
          </Text>
          <Text style={[
            styles.headerSubtitle,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            Stay updated with system alerts
          </Text>
        </View>
      </View>
      
      {/* Filter Buttons */}
      {renderFilterButtons()}
      
      {/* Loading state */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
          <Text style={[
            styles.loadingText,
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' }
          ]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlashList
          data={sections}
          estimatedItemSize={120}
          renderItem={({ item }) => (
            <View>
              {renderSectionHeader({ section: item })}
              {item.data.map((notification) => (
                <View key={notification.id}>
                  {renderNotificationItem({ item: notification })}
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={renderEmptyComponent}
          ListFooterComponent={renderFooterComponent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
              tintColor={isDarkMode ? '#60A5FA' : '#3B82F6'}
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterButtonActive: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  markAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    borderRadius: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityIndicator: {
    width: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  notificationContent: {
    flex: 1,
    padding: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 15,
    flex: 1,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 36,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 36,
  },
  notificationTimestamp: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 12,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
}); 