const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withFixedGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults && config.modResults.contents) {
      // Strip any line containing enableBundleCompression regardless of \n or \r\n line endings
      config.modResults.contents = config.modResults.contents.replace(
        /.*enableBundleCompression.*/g,
        '// enableBundleCompression removed for RN 0.76 compatibility'
      );
    }
    return config;
  });
};
