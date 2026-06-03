import * as vscode from 'vscode';
import { AliasConfig } from '../types';
import { readTsconfigPaths } from './tsconfig-reader';
import { readViteConfig } from './vite-config-reader';
import { readWebpackConfig } from './webpack-config-reader';

export function buildAliasConfig(projectRoot: string): AliasConfig {
  const config: AliasConfig = {};

  // Priority: webpack < vite < tsconfig < user config
  // (last write wins for same key)

  // 1. Webpack (lowest priority)
  try {
    const webpackAliases = readWebpackConfig(projectRoot);
    for (const [key, val] of Object.entries(webpackAliases)) {
      config[key] = val;
    }
  } catch {
    // Webpack config read failed, skip
  }

  // 2. Vite
  try {
    const viteAliases = readViteConfig(projectRoot);
    for (const [key, val] of Object.entries(viteAliases)) {
      config[key] = val;
    }
  } catch {
    // Vite config read failed, skip
  }

  // 3. tsconfig paths
  try {
    const tsconfigAliases = readTsconfigPaths(projectRoot);
    for (const [key, val] of Object.entries(tsconfigAliases)) {
      config[key] = val;
    }
  } catch {
    // tsconfig read failed, skip
  }

  // 4. User manual config (highest priority)
  const userConfig = vscode.workspace.getConfiguration('findExport');
  const userAliases = userConfig.get<Record<string, string>>('aliases', {});
  for (const [key, val] of Object.entries(userAliases)) {
    config[key] = val;
  }

  return config;
}
