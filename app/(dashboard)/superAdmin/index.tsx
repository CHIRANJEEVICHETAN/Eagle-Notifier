import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, Dimensions, Platform, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
// import OrganizationManagement from '../../components/OrganizationManagement';
// import SuperAdminUserManagement from '../../components/SuperAdminUserManagement';
import { useRouter, usePathname } from 'expo-router';
// Import org-aware API (to be implemented if not present)
// import { fetchOrganizations, createOrganization, updateOrganization, deleteOrganization } from '../../api/superAdminApi';
import { Ionicons } from '@expo/vector-icons';

const windowWidth = Dimensions.get('window').width;
const highDPIPhones = 380;

const SUPER_ADMIN_SECTIONS = [
  {
    key: 'org-management',
    icon: 'business-outline',
    title: 'Organization Management',
    route: '/(dashboard)/superAdmin/orgManagement',
    description: 'View, create, edit, and delete organizations. Manage SCADA DB configs and schema mappings.'
  },
  {
    key: 'user-management',
    icon: 'people-outline',
    title: 'User Management',
    route: '/(dashboard)/superAdmin/userManagement',
    description: 'Manage users across all organizations. Assign roles, reset passwords, and more.'
  },
  {
    key: 'global-search',
    icon: 'search-outline',
    title: 'Global Search & Analytics',
    route: '/(dashboard)/superAdmin/globalSearch',
    description: 'Search/view alarms, notifications, and reports across all organizations.'
  },
];

const CARD_COLORS = [
  // Soft, theme-aware, not too vibrant
  { light: ['#e0e7ff', '#f1f5f9'], dark: ['#1e293b', '#334155'] }, // Org
  { light: ['#fef9c3', '#f1f5f9'], dark: ['#334155', '#1e293b'] }, // User
  { light: ['#cffafe', '#f1f5f9'], dark: ['#334155', '#1e293b'] }, // Search
];

const SuperAdminDashboard = () => {
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Navigation function with debugging
  const handleNavigation = (route: string, sectionTitle: string) => {
    try {
      router.push(route as any);
      console.log('✅ router.push successful');
    } catch (error) {
      console.error('❌ router.push failed:', error);
      // Try alternative navigation methods
      try {
        console.log('- Attempting router.navigate...');
        (router as any).navigate(route);
        console.log('✅ router.navigate successful');
      } catch (navError) {
        console.error('❌ router.navigate failed:', navError);
        try {
          console.log('- Attempting router.replace...');
          router.replace(route as any);
          console.log('✅ router.replace successful');
        } catch (replaceError) {
          console.error('❌ router.replace failed:', replaceError);
        }
      }
    }
  };

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

  // Animation state for each card
  const [cardScales] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(1)));
  // Breathing animation state for each card
  const [breathScales] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(1)));
  // Entry animation state for each card
  const [cardTranslates] = useState(() => SUPER_ADMIN_SECTIONS.map((_, idx) => new Animated.Value(idx < 2 ? -80 : 80)));
  const [cardOpacities] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(0)));

  useEffect(() => {
    // Animate entry: first 2 from left, next 2 from right
    const animations = SUPER_ADMIN_SECTIONS.map((_, idx) =>
      Animated.parallel([
        Animated.timing(cardTranslates[idx], {
          toValue: 0,
          duration: 520 + idx * 60,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacities[idx], {
          toValue: 1,
          duration: 420 + idx * 60,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(80, animations).start();

    // Breathing animation loop for each card
    SUPER_ADMIN_SECTIONS.forEach((_, idx) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScales[idx], {
            toValue: 1.045,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(breathScales[idx], {
            toValue: 0.97,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(breathScales[idx], {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );
      setTimeout(() => loop.start(), idx * 350); // stagger start
    });
  }, []);

  // Card press in/out handlers
  const handlePressIn = (idx: number) => {
    Animated.spring(cardScales[idx], {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };
  const handlePressOut = (idx: number) => {
    Animated.spring(cardScales[idx], {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(30,41,59,0.95)' : 'rgba(248,250,252,0.95)', borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoContainer, { backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', borderRadius: 16, width: 48, height: 48, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}> 
            <Image
              source={require('../../../assets/images/icon.png')}
              style={{ width: 48, height: 48, borderRadius: 16 }}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.titleContainer, { maxWidth: windowWidth - 110, flexShrink: 1 }]}> 
            <Text
              style={{
                fontSize: 22,
                fontWeight: 'bold',
                color: isDarkMode ? '#60A5FA' : '#2563EB', // deep blue
                textShadowColor: isDarkMode ? 'rgba(30,41,59,0.7)' : 'rgba(59,130,246,0.18)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
                letterSpacing: 0.5,
                maxWidth: '100%',
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Super Admin
            </Text>
            <Text
              style={{
                fontSize: 12, // reduced for better fit
                fontStyle: 'italic',
                fontWeight: '600',
                color: isDarkMode ? '#22d3ee' : '#06b6d4', // cyan/teal
                marginTop: 2,
                letterSpacing: 0.1,
                maxWidth: '100%',
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Centralized Organization & User Management
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Removed the right-side icon and user name for a clean look */}
        </View>
      </View>
      {/* Body */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}> 
        <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'space-evenly', minHeight: 420, marginTop: 8 }}>
          {SUPER_ADMIN_SECTIONS.map((section, idx) => {
            const colors = CARD_COLORS[idx % CARD_COLORS.length][isDarkMode ? 'dark' : 'light'];
            const shadowColor = isDarkMode ? 'rgba(56,189,248,0.35)' : 'rgba(59,130,246,0.22)';
            return (
              <Animated.View
                key={section.key}
                style={{
                  flex: 1,
                  minHeight: 0,
                  marginBottom: idx < SUPER_ADMIN_SECTIONS.length - 1 ? 18 : 0,
                  borderRadius: 16,
                  shadowColor: shadowColor,
                  shadowOffset: { width: 8, height: 12 },
                  shadowOpacity: 0.45,
                  shadowRadius: 14,
                  elevation: 7,
                  backgroundColor: colors[0],
                  opacity: cardOpacities[idx],
                  transform: [
                    { scale: Animated.multiply(cardScales[idx], breathScales[idx]) },
                    { translateX: cardTranslates[idx] },
                  ],
                  maxWidth: '100%',
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPressIn={() => handlePressIn(idx)}
                  onPressOut={() => handlePressOut(idx)}
                  onPress={() => handleNavigation(section.route, section.title)}
                  style={{ borderRadius: 16, overflow: 'hidden', flex: 1 }}
                >
                  <View
                    style={{
                      flex: 1,
                      padding: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 16,
                      minHeight: 120,
                      backgroundColor: colors[1],
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(59,130,246,0.10)' : 'rgba(37,99,235,0.07)',
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 10,
                        shadowColor: shadowColor,
                        shadowOffset: { width: 4, height: 6 },
                        shadowOpacity: 0.18,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <Ionicons
                        name={section.icon as any}
                        size={32}
                        color={isDarkMode ? '#60A5FA' : '#2563EB'}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: isDarkMode ? '#F8FAFC' : '#1E293B',
                        marginBottom: 6,
                        textAlign: 'center',
                        letterSpacing: 0.1,
                      }}
                    >
                      {section.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDarkMode ? '#94A3B8' : '#475569',
                        textAlign: 'center',
                        fontWeight: '500',
                        lineHeight: 16,
                      }}
                    >
                      {section.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      {/* Bottom Navigation */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomNavContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#e3edfa', borderTopLeftRadius: 18, borderTopRightRadius: 18, shadowColor: isDarkMode ? '#60A5FA' : '#2563EB', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.01, shadowRadius: 2, elevation: 1 }]}> 
        <View style={[styles.bottomNav, { backgroundColor: isDarkMode ? '#1e293b' : '#e3edfa', borderTopColor: isDarkMode ? '#374151' : '#E2E8F0' }]}> 
          {[
            { name: 'Dashboard', icon: 'home', route: '/(dashboard)/superAdmin', active: true },
            { name: 'Organizations', icon: 'business-outline', route: '/(dashboard)/superAdmin/orgManagement', active: false },
            { name: 'Users', icon: 'people-outline', route: '/(dashboard)/superAdmin/userManagement', active: false },
            { name: 'Settings', icon: 'settings-outline', route: '/(dashboard)/profile', active: false },
          ].map(item => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => handleNavigation(item.route, item.name)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={item.active ? (isDarkMode ? '#60A5FA' : '#2563EB') : (isDarkMode ? '#94A3B8' : '#64748B')}
              />
              <Text style={[styles.navLabel, { color: item.active ? (isDarkMode ? '#60A5FA' : '#2563EB') : (isDarkMode ? '#94A3B8' : '#64748B') }]} numberOfLines={1}>{item.name}</Text>
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