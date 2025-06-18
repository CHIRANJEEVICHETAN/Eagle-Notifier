import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withRepeat, 
  withSequence,
  withDelay,
  Easing,
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Animation values
  const floatY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity1 = useSharedValue(0);
  const textOpacity2 = useSharedValue(0);
  const textOpacity3 = useSharedValue(0);
  const lineWidth = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const decorPosition1 = useSharedValue(-30);
  const decorPosition2 = useSharedValue(30);

  useEffect(() => {
    // Floating animation for icon
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(10, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Rotation animation
    rotateZ.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Scale and fade in for main content
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    
    // Staggered text animations
    textOpacity1.value = withDelay(400, withTiming(1, { duration: 600 }));
    textOpacity2.value = withDelay(600, withTiming(1, { duration: 600 }));
    textOpacity3.value = withDelay(800, withTiming(1, { duration: 600 }));
    
    // Animated line
    lineWidth.value = withDelay(900, withTiming(1, { duration: 1000 }));
    
    // Decorative elements animation
    decorPosition1.value = withDelay(500, withTiming(0, { 
      duration: 800, 
      easing: Easing.out(Easing.cubic) 
    }));
    
    decorPosition2.value = withDelay(700, withTiming(0, { 
      duration: 800, 
      easing: Easing.out(Easing.cubic) 
    }));
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotateZ: `${rotateZ.value}deg` },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  const animatedLine = useAnimatedStyle(() => ({
    width: interpolate(lineWidth.value, [0, 1], [0, 80], Extrapolate.CLAMP),
  }));

  const animatedText1 = useAnimatedStyle(() => ({
    opacity: textOpacity1.value,
    transform: [
      { translateY: interpolate(textOpacity1.value, [0, 1], [20, 0], Extrapolate.CLAMP) }
    ]
  }));

  const animatedText2 = useAnimatedStyle(() => ({
    opacity: textOpacity2.value,
    transform: [
      { translateY: interpolate(textOpacity2.value, [0, 1], [20, 0], Extrapolate.CLAMP) }
    ]
  }));

  const animatedText3 = useAnimatedStyle(() => ({
    opacity: textOpacity3.value,
    transform: [
      { translateY: interpolate(textOpacity3.value, [0, 1], [20, 0], Extrapolate.CLAMP) }
    ]
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }]
  }));

  const decorElement1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: decorPosition1.value }
    ],
    opacity: interpolate(decorPosition1.value, [-30, 0], [0, 1], Extrapolate.CLAMP)
  }));

  const decorElement2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: decorPosition2.value }
    ],
    opacity: interpolate(decorPosition2.value, [30, 0], [0, 1], Extrapolate.CLAMP)
  }));

  return (
    <View className="flex-1">
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={isDark 
          ? ['#0F172A', '#1E293B'] 
          : ['#EFF6FF', '#F8FAFC']}
        className="flex-1"
      >
        {/* Pattern Background */}
        <View className="absolute inset-0 opacity-5">
          <View className="absolute inset-0 flex-row flex-wrap">
            {Array.from({ length: 100 }).map((_, index) => (
              <View 
                key={index} 
                className={`w-8 h-8 border-r border-b ${isDark ? 'border-white' : 'border-black'}`} 
              />
            ))}
          </View>
        </View>

        {/* Top decorative element */}
        <Animated.View 
          style={[styles.topDecoration, decorElement1]} 
          className={isDark ? "bg-blue-600/10" : "bg-blue-500/10"}
        >
          <View className={`${isDark ? "border-blue-500/20" : "border-blue-500/30"} border-2 rounded-2xl w-full h-full`} />
        </Animated.View>

        {/* Bottom decorative element */}
        <Animated.View 
          style={[styles.bottomDecoration, decorElement2]} 
          className={isDark ? "bg-indigo-600/10" : "bg-indigo-500/10"}
        >
          <View className={`${isDark ? "border-indigo-500/20" : "border-indigo-500/30"} border-2 rounded-2xl w-full h-full`} />
        </Animated.View>

        {/* Main content container */}
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-full max-w-md bg-gradient-to-b from-white/5 to-white/10 rounded-3xl p-8 border border-white/10">
            <View className="items-center">
              {/* Error code with divider */}
              <View className="flex-row items-center justify-center mb-6">
                <Animated.View 
                  style={[animatedText1]} 
                  className="items-center"
                >
                  <Text
                    className={`text-5xl font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    4
                  </Text>
                </Animated.View>

                {/* Icon in the center */}
                <Animated.View style={[styles.iconOuterContainer, animatedIconStyle]}>
                  <BlurView
                    intensity={isDark ? 40 : 60}
                    tint={isDark ? "dark" : "light"}
                    style={styles.iconBlur}
                  >
                    <View className={`rounded-full p-4 ${isDark ? "bg-gray-800/70" : "bg-white/70"}`}>
                      <MaterialCommunityIcons
                        name="compass-off-outline"
                        size={60}
                        color={isDark ? '#60A5FA' : '#3B82F6'}
                      />
                    </View>
                  </BlurView>
                </Animated.View>

                <Animated.View 
                  style={[animatedText1]} 
                  className="items-center"
                >
                  <Text
                    className={`text-5xl font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    4
                  </Text>
                </Animated.View>
              </View>

              {/* Divider line */}
              <Animated.View 
                style={[styles.divider, animatedLine]}
                className={isDark ? "bg-blue-500/50" : "bg-blue-500/70"}
              />

              {/* Content */}
              <Animated.View
                style={[animatedText2]}
                className="items-center mt-6"
              >
                <Text
                  className={`text-2xl font-semibold mb-3 ${
                    isDark ? 'text-gray-200' : 'text-gray-800'
                  }`}
                >
                  Page Not Found
                </Text>
              </Animated.View>

              <Animated.View
                style={[animatedText3]}
                className="items-center"
              >
                <Text
                  className={`text-base text-center mb-8 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Oops! Looks like you've ventured into uncharted territory.
                  The page you're looking for doesn't exist or has been moved.
                </Text>

                {/* Button with pressed state animation */}
                <Pressable
                  onPress={() => router.back()}
                  onPressIn={() => {
                    buttonScale.value = withTiming(0.95, { duration: 100 });
                  }}
                  onPressOut={() => {
                    buttonScale.value = withTiming(1, { duration: 200 });
                  }}
                  className={`${
                    isDark ? 'bg-blue-600' : 'bg-blue-500'
                  }`}
                  style={styles.buttonContainer}
                >
                  <Animated.View 
                    style={[styles.buttonInner, animatedButtonStyle]}
                    className="flex-row items-center justify-center"
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white font-medium text-base">
                      Go Back
                    </Text>
                  </Animated.View>
                </Pressable>
                {/* Button with pressed state animation */}
                <Pressable
                  onPress={() => router.replace('/')}
                  onPressIn={() => {
                    buttonScale.value = withTiming(0.95, { duration: 100 });
                  }}
                  onPressOut={() => {
                    buttonScale.value = withTiming(1, { duration: 200 });
                  }}
                  className={`${
                    isDark ? 'bg-blue-600' : 'bg-blue-500'
                  }`}
                  style={styles.buttonContainer}
                >
                  <Animated.View 
                    style={[styles.buttonInner, animatedButtonStyle]}
                    className="flex-row items-center justify-center"
                  >
                    <MaterialCommunityIcons
                      name="home"
                      size={20}
                      color="white"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white font-medium text-base">
                      Go Home
                    </Text>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Code dots decoration */}
        <View className="absolute right-6 top-1/4">
          {[...Array(5)].map((_, i) => (
            <View 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full mb-1.5 ${
                isDark ? 'bg-blue-400/50' : 'bg-blue-500/50'
              }`} 
            />
          ))}
        </View>
        <View className="absolute left-6 bottom-1/4">
          {[...Array(5)].map((_, i) => (
            <View 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full mb-1.5 ${
                isDark ? 'bg-indigo-400/50' : 'bg-indigo-500/50'
              }`} 
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  topDecoration: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_HEIGHT * 0.2,
    top: SCREEN_HEIGHT * 0.12,
    left: -20,
    borderRadius: 16,
    overflow: 'hidden',
    transform: [{ rotate: '-15deg' }],
  },
  bottomDecoration: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_HEIGHT * 0.15,
    bottom: SCREEN_HEIGHT * 0.12,
    right: -10,
    borderRadius: 16,
    overflow: 'hidden',
    transform: [{ rotate: '10deg' }],
  },
  divider: {
    height: 4,
    borderRadius: 2,
  },
  iconOuterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    marginHorizontal: 10,
  },
  iconBlur: {
    borderRadius: 50,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    overflow: 'hidden',
    borderRadius: 16,
    marginTop: 10,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonInner: {
    padding: 16,
    paddingHorizontal: 32,
  },
});
