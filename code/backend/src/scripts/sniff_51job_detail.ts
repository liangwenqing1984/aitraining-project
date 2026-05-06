// 诊断脚本v2：用 Puppeteer 拦截 51job SPA详情页 (we.51job.com) 的 API 请求
import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function main() {
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\job51_detail_sniff_${Date.now()}`;

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
    if (url.includes('api') || url.includes('json') || url.includes('Ajax') ||
        url.includes('cupid') || url.includes('vapi') || url.includes('/open/') ||
        url.includes('/rest/') || url.includes('graphql')) {
      apiCalls.push({ url, method: req.method(), status: 0, contentType: '', bodyPreview: '' });
    }
    req.continue();
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    const contentType = resp.headers()['content-type'] || '';
    if (contentType.includes('json') || url.includes('/api/') || url.includes('/open/') || url.includes('cupid')) {
      try {
        const text = await resp.text();
        const idx = apiCalls.findIndex(c => c.url === url);
        if (idx >= 0) {
          apiCalls[idx].status = resp.status();
          apiCalls[idx].contentType = contentType;
          apiCalls[idx].bodyPreview = text.substring(0, 600);
        } else if (contentType.includes('json')) {
          apiCalls.push({
            url, method: resp.request().method(), status: resp.status(),
            contentType, bodyPreview: text.substring(0, 600),
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

  // 直接访问 we.51job.com 的 SPA 详情页（URL格式来自搜索结果中的 encryptJobId/href）
  console.log('Step 1: Loading we.51job.com search page to establish session...');
  await page.goto('https://we.51job.com/pc/search?keyword=%E4%B8%BB%E6%92%AD&jobArea=030000', {
    waitUntil: 'networkidle2', timeout: 45000,
  });
  console.log('Search page loaded, waiting...');
  await new Promise(r => setTimeout(r, 5000));

  // 尝试点击进入详情页（SPA路由）
  console.log('Step 2: Clicking first job item to trigger detail API...');
  try {
    // 点击搜索结果的第一个职位卡片触发SPA路由到详情
    await page.click('.joblist-item a, .job-item a, [class*="job"] a[href*="detail"], .result-list a[href*="detail"]');
    console.log('Clicked, waiting for detail page to load...');
    await new Promise(r => setTimeout(r, 10000));
  } catch (e: any) {
    console.log('Click failed, trying direct navigation...');
    // 尝试直接导航到PC详情页
    try {
      await page.goto('https://we.51job.com/pc/detail?jobId=155549199', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 8000));
    } catch (e2: any) {
      console.log('Direct navigation failed:', e2.message);
    }
  }

  console.log('\n========== API CALLS ==========');
  apiCalls.forEach(c => {
    console.log(`[${c.status}] ${c.method} ${c.url.substring(0, 180)}`);
    if (c.bodyPreview) console.log(`  body: ${c.bodyPreview.substring(0, 300)}`);
  });

  console.log('\n========== JSON RESPONSES ==========');
  xhrBodies.forEach(r => {
    console.log(`URL: ${r.url.substring(0, 180)}`);
    const keys = Array.isArray(r.data) ? `Array[${r.data.length}]` : Object.keys(r.data).join(', ');
    console.log(`Data keys: ${keys}`);
    console.log(JSON.stringify(r.data).substring(0, 1000));
    console.log('---');
  });

  const outPath = 'D:/AICODEING/aitraining/code/debug/job51_detail_sniff.json';
  fs.writeFileSync(outPath, JSON.stringify({ apiCalls, xhrBodies }, null, 2));
  console.log(`\nFull results saved to ${outPath}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
