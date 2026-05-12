import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Auto-detect Chrome executable path.
 * Priority: CHROME_PATH env → project .chrome/ → puppeteer cache → system paths
 */
function findChromePath(): string {
  // 1. Environment variable
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    console.log('[ChromePath] Using CHROME_PATH env:', process.env.CHROME_PATH);
    return process.env.CHROME_PATH;
  }

  // 2. Project-relative .chrome/ directory (for portability)
  const projectChromeDir = path.join(process.cwd(), '.chrome');
  if (fs.existsSync(projectChromeDir)) {
    const files = fs.readdirSync(projectChromeDir);
    for (const f of files) {
      const fullPath = path.join(projectChromeDir, f);
      if (f.endsWith('.exe') && fs.statSync(fullPath).isFile()) {
        console.log('[ChromePath] Using project .chrome/ dir:', fullPath);
        return fullPath;
      }
    }
  }

  // 3. Puppeteer cache (auto-detect latest version)
  const puppeteerCacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(puppeteerCacheDir)) {
    const dirs = fs.readdirSync(puppeteerCacheDir)
      .filter(d => d.startsWith('win64-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      const chromeExe = path.join(puppeteerCacheDir, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(chromeExe)) {
        console.log('[ChromePath] Using puppeteer cache:', chromeExe);
        return chromeExe;
      }
    }
  }

  // 4. System paths (fallback)
  const systemPaths = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
      ];

  for (const p of systemPaths) {
    if (fs.existsSync(p)) {
      console.log('[ChromePath] Using system Chrome:', p);
      return p;
    }
  }

  throw new Error(
    'Chrome executable not found. ' +
    'Set CHROME_PATH env var, or place Chrome in the project\'s .chrome/ directory, ' +
    'or run: npx puppeteer browsers install chrome'
  );
}

/**
 * Generate a project-relative user data directory for Puppeteer.
 * Uses .cache/puppeteer/tmp/ under project root for portability.
 */
export function getUserDataDir(name: string): string {
  const dir = path.join(process.cwd(), '.cache', 'puppeteer', 'tmp', `${name}_${Date.now()}`);
  return dir;
}

export const CHROME_PATH = findChromePath();
