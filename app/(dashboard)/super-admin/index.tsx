import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import OrganizationManagement from '../../components/OrganizationManagement';
import SuperAdminUserManagement from '../../components/SuperAdminUserManagement';
import { useRouter } from 'expo-router';
// Import org-aware API (to be implemented if not present)
// import { fetchOrganizations, createOrganization, updateOrganization, deleteOrganization } from '../../api/superAdminApi';

const windowWidth = Dimensions.get('window').width;
const highDPIPhones = 380;

const SUPER_ADMIN_SECTIONS = [
  {
    key: 'org-management',
    icon: 'business-outline',
    title: 'Organization Management',
    route: '/(dashboard)/super-admin/org-management',
    description: 'View, create, edit, and delete organizations. Manage SCADA DB configs and schema mappings.'
  },
  {
    key: 'user-management',
    icon: 'people-outline',
    title: 'User Management',
    route: '/(dashboard)/super-admin/user-management',
    description: 'Manage users across all organizations. Assign roles, reset passwords, and more.'
  },
  {
    key: 'scada-config',
    icon: 'settings-outline',
    title: 'SCADA Config & Schema',
    route: '/(dashboard)/super-admin/scada-config',
    description: 'Configure SCADA DB connections and schema mapping for each organization.'
  },
  {
    key: 'impersonation',
    icon: 'person-circle-outline',
    title: 'Impersonation / Switch Context',
    route: '/(dashboard)/super-admin/impersonation',
    description: 'Impersonate org admins/operators for support and troubleshooting.'
  },
  {
    key: 'global-search',
    icon: 'search-outline',
    title: 'Global Search & Analytics',
    route: '/(dashboard)/super-admin/global-search',
    description: 'Search/view alarms, notifications, and reports across all organizations.'
  },
];

const SuperAdminDashboard = () => {
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();

  // Theme colors
  const THEME = useMemo(() => ({
    dark: {
      background: '#0F172A',
      cardBg: '#1E293B',
      text: {
        primary: '#F8FAFC',
        secondary: '#94A3B8',
        accent: '#60A5FA',
      },
      border: '#334155',
      shadow: 'rgba(0, 0, 0, 0.25)',
    },
    light: {
      background: '#F8FAFC',
      cardBg: '#FFFFFF',
      text: {
        primary: '#1E293B',
        secondary: '#475569',
        accent: '#2563EB',
      },
      border: '#E2E8F0',
      shadow: 'rgba(0, 0, 0, 0.1)',
    },
  }), []);

  const theme = isDarkMode ? THEME.dark : THEME.light;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>  
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(30,41,59,0.95)' : 'rgba(248,250,252,0.95)', borderBottomColor: theme.border }]}>  
        <View style={styles.headerLeft}>
          <View style={[styles.logoContainer, { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }]}>  
            <Ionicons name="shield-checkmark-outline" size={40} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Super Admin</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>Centralized Organization & User Management</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Ionicons name="person" size={24} color={theme.text.accent} />
          <Text style={[styles.headerUser, { color: theme.text.accent }]}>{authState.user?.name || 'Super Admin'}</Text>
        </View>
      </View>
      {/* Body */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionHeading, { color: theme.text.primary }]}>Super Admin Portal</Text>
        <Text style={[styles.sectionDescription, { color: theme.text.secondary }]}>Manage all organizations, users, and system-wide settings from one place.</Text>
        <View style={styles.sectionsGrid}>
          {SUPER_ADMIN_SECTIONS.map(section => (
            <TouchableOpacity
              key={section.key}
              style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowColor: theme.shadow }]}
              activeOpacity={0.85}
              onPress={() => router.push(section.route as any)}
            >
              <Ionicons name={section.icon as any} size={32} color={theme.text.accent} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{section.title}</Text>
              <Text style={[styles.sectionDesc, { color: theme.text.secondary }]}>{section.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Removed OrganizationManagement and SuperAdminUserManagement from dashboard */}
      </ScrollView>
      {/* Bottom Navigation */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomNavContainer, { backgroundColor: theme.cardBg }]}>  
        <View style={[styles.bottomNav, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>  
          {[
            { name: 'Dashboard', icon: 'home', route: '/(dashboard)/super-admin', active: true },
            { name: 'Organizations', icon: 'business-outline', route: '/(dashboard)/super-admin/org-management', active: false },
            { name: 'Users', icon: 'people-outline', route: '/(dashboard)/super-admin/user-management', active: false },
            { name: 'Settings', icon: 'settings-outline', route: '/(dashboard)/profile', active: false },
          ].map(item => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={item.active ? theme.text.accent : theme.text.secondary}
              />
              <Text style={[styles.navLabel, { color: item.active ? theme.text.accent : theme.text.secondary }]} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          ))}
    </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 70,
    maxWidth: windowWidth,
    alignSelf: 'center',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoContainer: { padding: 8, borderRadius: 14 },
  titleContainer: { marginLeft: 14 },
  headerTitle: { fontSize: windowWidth > highDPIPhones ? 18 : 16, fontWeight: windowWidth > highDPIPhones ? 'bold' : '800', flexWrap: 'wrap' },
  headerSubtitle: { fontSize: windowWidth > highDPIPhones ? 12 : 12, marginTop: 2, fontWeight: '400' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerUser: { marginLeft: 6, fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 80 },
  sectionHeading: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sectionDescription: { fontSize: 14, marginBottom: 18 },
  sectionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sectionCard: {
    width: '48%',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionIcon: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  sectionDesc: { fontSize: 12, textAlign: 'center' },
  bottomNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    width: '100%',
  },
  navItem: { flex: 1, minWidth: 64, height: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  navLabel: { fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '500' },
});

export default SuperAdminDashboard;