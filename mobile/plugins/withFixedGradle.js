const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withFixedGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('enableBundleCompression')) {
      config.modResults.contents = config.modResults.contents.replace(
        /enableBundleCompression = .*\n/g,
        '// enableBundleCompression removed for RN 0.76 compatibility\n'
      );
    }
    return config;
  });
};
