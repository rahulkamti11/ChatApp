const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all source files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Ignore build outputs, android .gradle, and temporary cache folders in file watcher
config.resolver.blockList = [
  /.*\/android\/\.gradle\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/ios\/build\/.*/,
];

// 3. Resolve node_modules from both project and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 4. Explicitly map @chatapp/shared to the shared folder for Metro bundler
config.resolver.extraNodeModules = {
  '@chatapp/shared': path.resolve(workspaceRoot, 'shared'),
};

module.exports = config;
