import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

describe('Build Tests', () => {
  it('TypeScript 类型检查应该通过', () => {
    expect(() => {
      execSync('npm run build', {
        cwd: rootDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    }).not.toThrow();
  });

  it('Vite 构建应该通过', { timeout: 60000 }, () => {
    // 注意：这个测试需要较长时间
    expect(() => {
      execSync('npm run build:vite', {
        cwd: rootDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    }).not.toThrow();
  });
});
