// 诊断脚本：用 Puppeteer 拦截 51job 详情页的 API 请求，逆向出职位详情 API 端点
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { CHROME_PATH, getUserDataDir } from '../config/chromePath';

async function main() {
  const chromePath = CHROME_PATH;
  const userDataDir = getUserDataDir('job51_api_sniff');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir,
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--window-size=1920x1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  const apiCalls: { url: string; method: string; status: number; contentType: string; bodyPreview: string }[] = [];
  const xhrBodies: { url: string; data: any }[] = [];

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    const method = req.method();
    if (url.includes('api') || url.includes('json') || url.includes('Ajax') ||
        url.includes('51job.com') || url.includes('detail') || url.includes('/rest/') ||
        url.includes('we.51job') || url.includes('search') || url.includes('m.51job')) {
      apiCalls.push({ url, method, status: 0, contentType: '', bodyPreview: '' });
    }
    req.continue();
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    const contentType = resp.headers()['content-type'] || '';
    if (contentType.includes('json') || contentType.includes('javascript') ||
        url.includes('/api/') || url.includes('/rest/') || url.includes('51job.com')) {
      try {
        const text = await resp.text();
        const idx = apiCalls.findIndex(c => c.url === url);
        if (idx >= 0) {
          apiCalls[idx].status = resp.status();
          apiCalls[idx].contentType = contentType;
          apiCalls[idx].bodyPreview = text.substring(0, 800);
        } else if (contentType.includes('json')) {
          apiCalls.push({
            url, method: resp.request().method(), status: resp.status(),
            contentType, bodyPreview: text.substring(0, 800),
          });
        }
        if (contentType.includes('json')) {
          try {
            const json = JSON.parse(text);
            xhrBodies.push({ url, data: json });
          } catch {}
        }
      } catch {}
    }
  });

  // 先访问列表页建立会话
  console.log('Step 1: Loading list page...');
  await page.goto('https://we.51job.com/pc/search?keyword=%E4%B8%BB%E6%92%AD&jobArea=030000', {
    waitUntil: 'networkidle2', timeout: 45000,
  });
  console.log('List page loaded, waiting...');
  await new Promise(r => setTimeout(r, 5000));

  // 导航到详情页
  const detailUrl = 'https://jobs.51job.com/beijing/155549199.html';
  console.log('Step 2: Navigating to detail page:', detailUrl);
  try {
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch (e: any) {
    console.log('Navigation ended:', e.message);
  }
  await new Promise(r => setTimeout(r, 8000));

  console.log('\n========== API CALLS ==========');
  apiCalls.forEach(c => {
    console.log(`[${c.status}] ${c.method} ${c.url.substring(0, 150)}`);
    if (c.bodyPreview) console.log(`  body: ${c.bodyPreview.substring(0, 300)}`);
  });

  console.log('\n========== JSON RESPONSES ==========');
  xhrBodies.forEach(r => {
    console.log(`URL: ${r.url.substring(0, 150)}`);
    console.log(`Data keys: ${Object.keys(r.data).join(', ')}`);
    console.log(JSON.stringify(r.data).substring(0, 800));
    console.log('---');
  });

  const outPath = 'D:/AICODEING/aitraining/code/debug/job51_api_sniff.json';
  fs.writeFileSync(outPath, JSON.stringify({ apiCalls, xhrBodies }, null, 2));
  console.log(`\nFull results saved to ${outPath}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
