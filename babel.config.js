module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-logical-assignment-operators',
      'react-native-reanimated/plugin'
    ]
  };
};
