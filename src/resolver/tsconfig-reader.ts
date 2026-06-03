import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AliasConfig } from '../types';

export function readTsconfigPaths(projectRoot: string): AliasConfig {
  const aliases: AliasConfig = {};

  const configFiles = ['tsconfig.json', 'jsconfig.json'];
  let configPath: string | undefined;

  for (const cf of configFiles) {
    const p = path.join(projectRoot, cf);
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    return aliases;
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error || !configFile.config) {
    return aliases;
  }

  const compilerOptions = configFile.config.compilerOptions;
  if (!compilerOptions?.paths) {
    return aliases;
  }

  const baseUrl = compilerOptions.baseUrl
    ? path.resolve(projectRoot, compilerOptions.baseUrl)
    : projectRoot;

  for (const [alias, mappings] of Object.entries(compilerOptions.paths)) {
    const mapping = Array.isArray(mappings) ? mappings[0] : mappings;
    if (typeof mapping === 'string') {
      const resolved = path.relative(projectRoot, path.resolve(baseUrl, mapping));
      aliases[alias] = resolved;
    }
  }

  return aliases;
}
