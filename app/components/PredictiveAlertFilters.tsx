import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface PredictiveAlertFilterOptions {
  status: 'all' | 'active' | 'acknowledged' | 'resolved';
  confidence: 'all' | 'high' | 'medium' | 'low';
  timeToFailure: 'all' | 'immediate' | 'short' | 'medium';
  component: 'all' | string;
  sortBy: 'timestamp' | 'confidence' | 'timeToFailure';
  sortOrder: 'asc' | 'desc';
}

interface PredictiveAlertFiltersProps {
  filters: PredictiveAlertFilterOptions;
  onFiltersChange: (filters: PredictiveAlertFilterOptions) => void;
  availableComponents?: string[];
}

export const PredictiveAlertFilters: React.FC<PredictiveAlertFiltersProps> = ({
  filters,
  onFiltersChange,
  availableComponents = [],
}) => {
  const { isDarkMode } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const colors = {
    background: isDarkMode ? '#1E293B' : '#FFFFFF',
    cardBg: isDarkMode ? '#334155' : '#F8FAFC',
    text: isDarkMode ? '#F8FAFC' : '#1E293B',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? '#475569' : '#E2E8F0',
    accent: isDarkMode ? '#3B82F6' : '#2563EB',
    active: isDarkMode ? '#1E40AF' : '#DBEAFE',
  };

  const updateFilter = <K extends keyof PredictiveAlertFilterOptions>(
    key: K,
    value: PredictiveAlertFilterOptions[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.confidence !== 'all') count++;
    if (filters.timeToFailure !== 'all') count++;
    if (filters.component !== 'all') count++;
    return count;
  };

  const resetFilters = () => {
    onFiltersChange({
      status: 'all',
      confidence: 'all',
      timeToFailure: 'all',
      component: 'all',
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  };

  const FilterButton: React.FC<{
    title: string;
    value: string;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }> = ({ title, value, options, onSelect }) => (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterTitle, { color: colors.text }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterOptions}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterOption,
                {
                  backgroundColor: value === option.value ? colors.accent : colors.cardBg,
                  borderColor: value === option.value ? colors.accent : colors.border,
                },
              ]}
              onPress={() => onSelect(option.value)}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  {
                    color: value === option.value ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <>
      {/* Filter trigger button */}
      <TouchableOpacity
        style={[styles.filterTrigger, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="filter-outline" size={20} color={colors.accent} />
        <Text style={[styles.filterTriggerText, { color: colors.text }]}>
          Filters
        </Text>
        {getActiveFiltersCount() > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Filter modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Filter Predictive Alerts
            </Text>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity
                style={[styles.resetButton, { backgroundColor: colors.cardBg }]}
                onPress={resetFilters}
              >
                <Text style={[styles.resetButtonText, { color: colors.accent }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.accent }]}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Status filter */}
            <FilterButton
              title="Status"
              value={filters.status}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Acknowledged', value: 'acknowledged' },
                { label: 'Resolved', value: 'resolved' },
              ]}
              onSelect={(value) => updateFilter('status', value as any)}
            />

            {/* Confidence filter */}
            <FilterButton
              title="Confidence Level"
              value={filters.confidence}
              options={[
                { label: 'All', value: 'all' },
                { label: 'High (90%+)', value: 'high' },
                { label: 'Medium (70-89%)', value: 'medium' },
                { label: 'Low (<70%)', value: 'low' },
              ]}
              onSelect={(value) => updateFilter('confidence', value as any)}
            />

            {/* Time to failure filter */}
            <FilterButton
              title="Time to Failure"
              value={filters.timeToFailure}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Immediate (<30min)', value: 'immediate' },
                { label: 'Short (30min-2h)', value: 'short' },
                { label: 'Medium (2h+)', value: 'medium' },
              ]}
              onSelect={(value) => updateFilter('timeToFailure', value as any)}
            />

            {/* Component filter */}
            {availableComponents.length > 0 && (
              <FilterButton
                title="Component"
                value={filters.component}
                options={[
                  { label: 'All', value: 'all' },
                  ...availableComponents.map(component => ({
                    label: component,
                    value: component,
                  })),
                ]}
                onSelect={(value) => updateFilter('component', value)}
              />
            )}

            {/* Sort options */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterTitle, { color: colors.text }]}>Sort By</Text>
              <View style={styles.sortContainer}>
                <FilterButton
                  title=""
                  value={filters.sortBy}
                  options={[
                    { label: 'Time', value: 'timestamp' },
                    { label: 'Confidence', value: 'confidence' },
                    { label: 'Time to Failure', value: 'timeToFailure' },
                  ]}
                  onSelect={(value) => updateFilter('sortBy', value as any)}
                />
                <FilterButton
                  title=""
                  value={filters.sortOrder}
                  options={[
                    { label: 'Newest First', value: 'desc' },
                    { label: 'Oldest First', value: 'asc' },
                  ]}
                  onSelect={(value) => updateFilter('sortOrder', value as any)}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  filterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTriggerText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  filterBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sortContainer: {
    gap: 12,
  },
});

export default PredictiveAlertFilters;