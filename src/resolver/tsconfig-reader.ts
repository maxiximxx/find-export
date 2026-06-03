import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AliasConfig } from '../types';

export function readTsconfigPaths(projectRoot: string): AliasConfig {
  const aliases: AliasConfig = {};

  // Find root tsconfig/jsconfig
  const configFiles = ['tsconfig.json', 'jsconfig.json'];
  let rootConfigPath: string | undefined;

  for (const cf of configFiles) {
    const p = path.join(projectRoot, cf);
    if (fs.existsSync(p)) {
      rootConfigPath = p;
      break;
    }
  }

  if (!rootConfigPath) {
    return aliases;
  }

  // Read root config
  const rootConfig = readConfig(rootConfigPath);
  if (!rootConfig) {
    return aliases;
  }

  // Extract paths from root config
  extractPaths(rootConfig, projectRoot, aliases);

  // Follow project references (e.g. tsconfig.json -> tsconfig.app.json)
  const references = rootConfig.references;
  if (Array.isArray(references)) {
    for (const ref of references) {
      if (ref.path) {
        const refConfigPath = path.resolve(projectRoot, ref.path);
        const refConfig = readConfig(refConfigPath);
        if (refConfig) {
          const refDir = path.dirname(refConfigPath);
          extractPaths(refConfig, refDir, aliases);
        }
      }
    }
  }

  return aliases;
}

function readConfig(configPath: string): any {
  try {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error || !configFile.config) {
      return null;
    }
    return configFile.config;
  } catch {
    return null;
  }
}

function extractPaths(
  config: any,
  configDir: string,
  aliases: AliasConfig
): void {
  const compilerOptions = config.compilerOptions;
  if (!compilerOptions?.paths) {
    return;
  }

  const baseUrl = compilerOptions.baseUrl
    ? path.resolve(configDir, compilerOptions.baseUrl)
    : configDir;

  for (const [alias, mappings] of Object.entries(compilerOptions.paths)) {
    const mapping = Array.isArray(mappings) ? mappings[0] : mappings;
    if (typeof mapping === 'string') {
      const resolved = path.relative(
        configDir,
        path.resolve(baseUrl, mapping)
      );
      // Referenced config overrides root config (more specific)
      aliases[alias] = resolved;
    }
  }
}
