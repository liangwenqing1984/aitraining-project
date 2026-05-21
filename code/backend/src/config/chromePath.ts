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

  const isWin = process.platform === 'win32';

  // 2. Project-relative .chrome/ directory (for portability)
  const projectChromeDir = path.join(process.cwd(), '.chrome');
  if (fs.existsSync(projectChromeDir)) {
    const files = fs.readdirSync(projectChromeDir);
    for (const f of files) {
      const fullPath = path.join(projectChromeDir, f);
      // Windows: must end with .exe; Linux: any non-hidden file with +x
      const isExecutable = isWin ? f.endsWith('.exe') : !f.startsWith('.');
      if (!isExecutable) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        if (!isWin) {
          try { fs.accessSync(fullPath, fs.constants.X_OK); } catch { continue; }
        }
        console.log('[ChromePath] Using project .chrome/ dir:', fullPath);
        return fullPath;
      } catch { /* skip unreadable */ }
    }
  }

  // 3. Puppeteer cache (auto-detect latest version)
  const puppeteerCacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(puppeteerCacheDir)) {
    const platformPrefix = isWin ? 'win64-' : 'linux-';
    const chromeDir = isWin ? 'chrome-win64' : 'chrome-linux64';
    const chromeExeName = isWin ? 'chrome.exe' : 'chrome';

    const dirs = fs.readdirSync(puppeteerCacheDir)
      .filter(d => d.startsWith(platformPrefix))
      .sort()
      .reverse();
    for (const d of dirs) {
      const chromeExe = path.join(puppeteerCacheDir, d, chromeDir, chromeExeName);
      if (fs.existsSync(chromeExe)) {
        console.log('[ChromePath] Using puppeteer cache:', chromeExe);
        return chromeExe;
      }
    }

    // Cross-platform fallback: scan all dirs for known patterns
    if (dirs.length === 0) {
      const patterns: Array<{ subdir: string; exe: string }> = [
        { subdir: 'chrome-win64', exe: 'chrome.exe' },
        { subdir: 'chrome-linux64', exe: 'chrome' },
      ];
      const allDirs = fs.readdirSync(puppeteerCacheDir).sort().reverse();
      for (const d of allDirs) {
        for (const { subdir, exe } of patterns) {
          const chromeExe = path.join(puppeteerCacheDir, d, subdir, exe);
          if (fs.existsSync(chromeExe)) {
            console.log('[ChromePath] Using puppeteer cache (fallback):', chromeExe);
            return chromeExe;
          }
        }
      }
    }
  }

  // 4. System paths (fallback)
  const systemPaths = isWin
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/opt/google/chrome/chrome',
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
