/**
 * Playwright globalSetup — runs once before the entire test suite.
 *
 * Builds the app in dev mode so individual spec files don't each pay
 * the build cost (and don't race on the `dist/` directory).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

export default function globalSetup(): void {
  const root = path.resolve(__dirname, '..');
  execSync('npm run build:dev', { cwd: root, stdio: 'inherit' });
}
