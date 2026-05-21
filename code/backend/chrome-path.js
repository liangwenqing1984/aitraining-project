/**
 * Shared Chrome path detection for standalone JS scripts.
 * Usage: const CHROME_PATH = require('./chrome-path');
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function findChromePath() {
  // 1. Environment variable
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const isWin = process.platform === 'win32';

  // 2. Puppeteer cache
  const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(cacheDir)) {
    const platformPrefix = isWin ? 'win64-' : 'linux-';
    const chromeDir = isWin ? 'chrome-win64' : 'chrome-linux64';
    const chromeName = isWin ? 'chrome.exe' : 'chrome';

    const dirs = fs.readdirSync(cacheDir).sort().reverse();
    for (const d of dirs) {
      const exe = path.join(cacheDir, d, chromeDir, chromeName);
      if (fs.existsSync(exe)) return exe;
    }
    // Cross-platform fallback
    for (const d of dirs) {
      for (const [subdir, name] of [['chrome-win64', 'chrome.exe'], ['chrome-linux64', 'chrome']]) {
        const exe = path.join(cacheDir, d, subdir, name);
        if (fs.existsSync(exe)) return exe;
      }
    }
  }

  // 3. System paths
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
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    'Chrome not found. Set CHROME_PATH env var or run: npx puppeteer browsers install chrome'
  );
}

module.exports = findChromePath();
