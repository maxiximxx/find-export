import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export function readGitignorePatterns(projectRoot: string): string[] {
  const patterns: string[] = [];
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    return patterns;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

export function isIgnored(
  filePath: string,
  patterns: string[],
  projectRoot: string
): boolean {
  const relativePath = path.relative(projectRoot, filePath);

  return patterns.some((pattern) => {
    // Handle negation patterns (e.g., !important.log)
    if (pattern.startsWith('!')) {
      return false; // Simplified: skip negation for now
    }

    // Match directory patterns (ending with /)
    if (pattern.endsWith('/')) {
      const dirPattern = pattern.slice(0, -1);
      return minimatch(relativePath, `**/${dirPattern}/**`) ||
             minimatch(relativePath, `**/${dirPattern}`);
    }

    // Match file patterns
    return minimatch(relativePath, pattern) ||
           minimatch(relativePath, `**/${pattern}`);
  });
}
