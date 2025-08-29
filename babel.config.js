module.exports = function(api) {
  api.cache(true); // Caches the config for faster builds
  return {
    presets: ['babel-preset-expo'], // Standard preset for Expo
    plugins: ['react-native-reanimated/plugin'], // Needed for Reanimated animations
  };
};
