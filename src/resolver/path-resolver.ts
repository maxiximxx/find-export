import * as path from 'path';
import * as fs from 'fs';
import { AliasConfig } from '../types';

export function resolveAlias(
  fromPath: string,
  currentFile: string,
  aliasConfig: AliasConfig,
  projectRoot: string
): string {
  // Relative path: resolve directly
  if (fromPath.startsWith('.')) {
    const dir = path.dirname(currentFile);
    const resolved = path.resolve(dir, fromPath);
    return addExtensionIfNeeded(resolved);
  }

  // Try matching aliases (longest match wins)
  const sortedAliases = Object.entries(aliasConfig).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [alias, target] of sortedAliases) {
    const hasStar = alias.endsWith('*');
    const aliasNoStar = alias.replace(/\*$/, '');

    if (hasStar) {
      // Wildcard alias: must have something after the prefix
      if (fromPath.startsWith(aliasNoStar) && fromPath.length > aliasNoStar.length) {
        const rest = fromPath.slice(aliasNoStar.length);
        const targetNoStar = target.replace(/\*$/, '');
        const resolved = path.resolve(projectRoot, targetNoStar + rest);
        return addExtensionIfNeeded(resolved);
      }
    } else {
      // Exact alias: must match exactly
      if (fromPath === aliasNoStar) {
        const resolved = path.resolve(projectRoot, target);
        return addExtensionIfNeeded(resolved);
      }
    }
  }

  // Cannot resolve (node_modules, etc.)
  return fromPath;
}

function addExtensionIfNeeded(filePath: string): string {
  const ext = path.extname(filePath);
  if (ext) {
    return filePath;
  }

  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const e of extensions) {
    const withExt = filePath + e;
    try {
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    } catch {
      // ignore
    }
  }

  for (const e of extensions) {
    const indexPath = path.join(filePath, `index${e}`);
    try {
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    } catch {
      // ignore
    }
  }

  return filePath;
}
