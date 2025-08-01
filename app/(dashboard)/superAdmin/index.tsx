import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
// import OrganizationManagement from '../../components/OrganizationManagement';
// import SuperAdminUserManagement from '../../components/SuperAdminUserManagement';
import { useRouter, usePathname } from 'expo-router';
import { useSuperAdminMetrics } from '../../hooks/useSuperAdminMetrics';
import { Ionicons } from '@expo/vector-icons';

const windowWidth = Dimensions.get('window').width;
const highDPIPhones = 380;

const SUPER_ADMIN_SECTIONS = [
  {
    key: 'org-management',
    icon: 'business-outline',
    title: 'Organization Management',
    route: '/(dashboard)/superAdmin/orgManagement',
    description:
      'View, create, edit, and delete organizations. Manage SCADA DB configs and schema mappings.',
  },
  {
    key: 'user-management',
    icon: 'people-outline',
    title: 'User Management',
    route: '/(dashboard)/superAdmin/userManagement',
    description: 'Manage users across all organizations. Assign roles, reset passwords, and more.',
  },
];

const CARD_COLORS = [
  // Soft, theme-aware, not too vibrant
  { light: ['#e0e7ff', '#f1f5f9'], dark: ['#1e293b', '#334155'] }, // Org
  { light: ['#fef9c3', '#f1f5f9'], dark: ['#334155', '#1e293b'] }, // User
  { light: ['#cffafe', '#f1f5f9'], dark: ['#334155', '#1e293b'] }, // Search
];

// Metrics color config
const METRICS_COLORS = {
  organizations: '#3B82F6', // Blue
  users: '#10B981', // Green
  active: '#EF4444', // Red
};

// Animated Metric Card Component
const AnimatedMetricCard: React.FC<{
  icon: string;
  value: string;
  title: string;
  subtitle: string;
  color: string;
  index: number;
}> = React.memo(({ icon, value, title, subtitle, color, index }) => {
  const { isDarkMode } = useTheme();
  const [cardScale] = useState(new Animated.Value(1));
  const [cardOpacity] = useState(new Animated.Value(0));
  const [cardTranslateY] = useState(new Animated.Value(40));
  const [breathScale] = useState(new Animated.Value(1));

  useEffect(() => {
    setTimeout(
      () => {
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(cardTranslateY, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start();
      },
      200 + index * 250
    );
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.02,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 0.98,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true }
    );
    setTimeout(() => loop.start(), 800 + index * 200);
    return () => loop.stop();
  }, []);

  const handlePressIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  // Theme-aware card background and shadow
  const cardBg = isDarkMode ? '#1E293B' : '#fff';
  const shadowColor = color + (isDarkMode ? '88' : '33');
  const borderColor = isDarkMode ? color : color + '33';

  return (
    <Animated.View
      style={[
        styles.metricCard,
        {
          backgroundColor: cardBg,
          borderColor,
          shadowColor,
          opacity: cardOpacity,
          transform: [
            { scale: Animated.multiply(cardScale, breathScale) },
            { translateY: cardTranslateY },
          ],
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
        }}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <View
          style={[
            styles.metricIconContainer,
            { backgroundColor: color + (isDarkMode ? '22' : '18') },
          ]}>
          <Ionicons name={icon as any} size={windowWidth > 400 ? 22 : 18} color={color} />
        </View>
        <Text style={[styles.metricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text
          style={[styles.metricTitle, { color: isDarkMode ? '#F8FAFC' : '#1E293B' }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {title}
        </Text>
        <Text
          style={[styles.metricSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}
          numberOfLines={2}
          adjustsFontSizeToFit>
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SuperAdminDashboard = () => {
  const { isDarkMode } = useTheme();
  const { authState } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { metrics, isLoading: metricsLoading, error: metricsError } = useSuperAdminMetrics();

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
  const THEME = useMemo(
    () => ({
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
    }),
    []
  );

  const theme = isDarkMode ? THEME.dark : THEME.light;

  // Animation state for each card
  const [cardScales] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(1)));
  // Breathing animation state for each card
  const [breathScales] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(1)));
  // Entry animation state for each card
  const [cardTranslates] = useState(() =>
    SUPER_ADMIN_SECTIONS.map((_, idx) => new Animated.Value(idx < 2 ? -80 : 80))
  );
  const [cardOpacities] = useState(() => SUPER_ADMIN_SECTIONS.map(() => new Animated.Value(0)));

  useEffect(() => {
    // Animate entry: first 2 from left, next 2 from right
    const animations = SUPER_ADMIN_SECTIONS.map((_, idx) =>
      Animated.parallel([
        Animated.timing(cardTranslates[idx], {
          toValue: 0,
          duration: 1000 + idx * 120,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacities[idx], {
          toValue: 1,
          duration: 900 + idx * 120,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(200, animations).start();

    // Breathing animation loop for each card
    SUPER_ADMIN_SECTIONS.forEach((_, idx) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScales[idx], {
            toValue: 1.045,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breathScales[idx], {
            toValue: 0.97,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breathScales[idx], {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );
      setTimeout(() => loop.start(), idx * 500); // slower stagger start
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
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDarkMode ? 'rgba(30,41,59,0.95)' : 'rgba(248,250,252,0.95)',
            borderBottomColor: theme.border,
          },
        ]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
                borderRadius: 16,
                width: 48,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              },
            ]}>
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
              ellipsizeMode="tail">
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
              ellipsizeMode="tail">
              Centralized Organization & User Management
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Removed the right-side icon and user name for a clean look */}
        </View>
      </View>
      {/* Metrics Grid Section */}
      <View style={styles.metricsContainer}>
        <Text style={[styles.metricsHeader, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>
          Quick Info
        </Text>
        <View style={styles.metricsGrid}>
          {metricsLoading ? (
            // Loading state
            Array.from({ length: 3 }).map((_, idx) => (
              <View key={`loading-${idx}`} style={[styles.metricCard, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                <View style={[styles.metricIconContainer, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
                  <Ionicons name="ellipsis-horizontal" size={24} color={isDarkMode ? '#94a3b8' : '#64748b'} />
                </View>
                <Text style={[styles.metricValue, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>...</Text>
                <Text style={[styles.metricTitle, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>Loading...</Text>
                <Text style={[styles.metricSubtitle, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>Please wait</Text>
              </View>
            ))
          ) : metricsError ? (
            // Error state
            Array.from({ length: 3 }).map((_, idx) => (
              <View key={`error-${idx}`} style={[styles.metricCard, { backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                <View style={[styles.metricIconContainer, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fee2e2' }]}>
                  <Ionicons name="alert-circle" size={24} color={isDarkMode ? '#ef4444' : '#dc2626'} />
                </View>
                <Text style={[styles.metricValue, { color: isDarkMode ? '#ef4444' : '#dc2626' }]}>--</Text>
                <Text style={[styles.metricTitle, { color: isDarkMode ? '#ef4444' : '#dc2626' }]}>Error</Text>
                <Text style={[styles.metricSubtitle, { color: isDarkMode ? '#fca5a5' : '#fecaca' }]}>Failed to load</Text>
              </View>
            ))
          ) : metrics ? (
            // Live data
            [
              {
                icon: 'business-outline',
                value: metrics.totalOrganizations.toString(),
                title: 'Organizations',
                subtitle: `${metrics.newOrganizationsThisWeek} new this week`,
                color: METRICS_COLORS.organizations,
              },
              {
                icon: 'people-outline',
                value: metrics.totalUsers.toString(),
                title: 'Total Users',
                subtitle: `${metrics.newUsersThisWeek} new this week`,
                color: METRICS_COLORS.users,
              },
              {
                icon: 'checkmark-circle-outline',
                value: metrics.activeOrganizations.toString(),
                title: 'Active',
                subtitle: `Out of ${metrics.totalOrganizations}`,
                color: METRICS_COLORS.active,
              },
            ].map((metric, idx) => (
              <AnimatedMetricCard key={metric.title} {...metric} index={idx} />
            ))
          ) : null}
        </View>
      </View>
      {/* Body */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}>
        <View
          style={{
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            minHeight: 420,
            marginTop: 8,
          }}>
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
                }}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPressIn={() => handlePressIn(idx)}
                  onPressOut={() => handlePressOut(idx)}
                  onPress={() => handleNavigation(section.route, section.title)}
                  style={{ borderRadius: 16, overflow: 'hidden', flex: 1 }}>
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
                    }}>
                    <View
                      style={{
                        backgroundColor: isDarkMode
                          ? 'rgba(59,130,246,0.10)'
                          : 'rgba(37,99,235,0.07)',
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 10,
                        shadowColor: shadowColor,
                        shadowOffset: { width: 4, height: 6 },
                        shadowOpacity: 0.18,
                        shadowRadius: 6,
                        elevation: 2,
                      }}>
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
                      }}>
                      {section.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDarkMode ? '#94A3B8' : '#475569',
                        textAlign: 'center',
                        fontWeight: '500',
                        lineHeight: 16,
                      }}>
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
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.bottomNavContainer,
          {
            backgroundColor: isDarkMode ? '#1e293b' : '#e3edfa',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            shadowColor: isDarkMode ? '#60A5FA' : '#2563EB',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.01,
            shadowRadius: 2,
            elevation: 1,
          },
        ]}>
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: isDarkMode ? '#1e293b' : '#e3edfa',
              borderTopColor: isDarkMode ? '#374151' : '#E2E8F0',
            },
          ]}>
          {[
            { name: 'Dashboard', icon: 'home', route: '/(dashboard)/superAdmin', active: true },
            {
              name: 'Organizations',
              icon: 'business-outline',
              route: '/(dashboard)/superAdmin/orgManagement',
              active: false,
            },
            {
              name: 'Users',
              icon: 'people-outline',
              route: '/(dashboard)/superAdmin/userManagement',
              active: false,
            },
            {
              name: 'Settings',
              icon: 'settings-outline',
              route: '/(dashboard)/profile',
              active: false,
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              onPress={() => handleNavigation(item.route, item.name)}
              accessibilityRole="button"
              accessibilityLabel={item.name}>
              <Ionicons
                name={item.icon as any}
                size={22}
                color={
                  item.active
                    ? isDarkMode
                      ? '#60A5FA'
                      : '#2563EB'
                    : isDarkMode
                      ? '#94A3B8'
                      : '#64748B'
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: item.active
                      ? isDarkMode
                        ? '#60A5FA'
                        : '#2563EB'
                      : isDarkMode
                        ? '#94A3B8'
                        : '#64748B',
                  },
                ]}
                numberOfLines={1}>
                {item.name}
              </Text>
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
  headerTitle: {
    fontSize: windowWidth > highDPIPhones ? 18 : 16,
    fontWeight: windowWidth > highDPIPhones ? 'bold' : '800',
    flexWrap: 'wrap',
  },
  headerSubtitle: {
    fontSize: windowWidth > highDPIPhones ? 12 : 12,
    marginTop: 2,
    fontWeight: '400',
  },
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
  navItem: {
    flex: 1,
    minWidth: 64,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navLabel: { fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '500' },
  metricsContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    zIndex: 2,
    maxWidth: windowWidth,
    width: '100%',
    alignSelf: 'center',
  },
  metricsHeader: {
    fontSize: windowWidth > highDPIPhones ? 18 : 18,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.2,
    textAlign: 'left',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 4,
    minHeight: windowWidth > 400 ? 128 : 110,
    paddingHorizontal: 8,
    maxWidth: windowWidth,
    width: '100%',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: (windowWidth - 48) / 3, // Ensures equal width: (total width - container padding - gaps) / 3 cards
    minHeight: windowWidth > 400 ? 128 : 115,
    borderRadius: 25,
    paddingVertical: windowWidth > 400 ? 14 : 10,
    paddingHorizontal: windowWidth > 400 ? 10 : 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.23,
    shadowRadius: 6,
    elevation: 8,
    backgroundColor: '#fff', // will be overridden by theme
  },
  metricIconContainer: {
    width: windowWidth > 400 ? 36 : 32,
    height: windowWidth > 400 ? 36 : 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  // Unified metric styles - consistent across all metrics
  metricValue: {
    fontSize: windowWidth > 400 ? 22 : 20,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: '100%',
    lineHeight: windowWidth > 400 ? 26 : 24,
  },
  metricTitle: {
    fontSize: windowWidth > 400 ? 12 : 11,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: 0.1,
    maxWidth: '100%',
    lineHeight: windowWidth > 400 ? 15 : 14,
  },
  metricSubtitle: {
    fontSize: windowWidth > 400 ? 10 : 9,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.05,
    maxWidth: '100%',
    lineHeight: windowWidth > 400 ? 13 : 12,
  },
});

export default SuperAdminDashboard;
