const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

module.exports = wrapWithReanimatedMetroConfig(
  withNativeWind(getDefaultConfig(__dirname), { input: './global.css' })
);