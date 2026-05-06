// @ts-nocheck
// 诊断脚本 v3：搜索页建立会话 → SPA内部导航详情 → 拦截详情API
import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function main() {
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\job51_detail_sniff_v3_${Date.now()}`;

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

  const xhrCalls: { url: string; method: string; status: number; contentType: string; bodyPreview: string }[] = [];
  const jsonBodies: { url: string; data: any }[] = [];

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    // 拦截所有看起来像API的请求
    if (url.includes('/api/') || url.includes('detail') || url.includes('/open/') ||
        url.includes('cupid') || url.includes('vapi') || url.includes('/rest/') ||
        url.includes('json') || url.includes('Ajax') || url.includes('getjob')) {
      xhrCalls.push({ url, method: req.method(), status: 0, contentType: '', bodyPreview: '' });
    }
    req.continue();
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    const contentType = resp.headers()['content-type'] || '';
    // 捕获所有 JSON 响应和 API URL 响应
    if (contentType.includes('json') || url.includes('/api/') || url.includes('cupid') || url.includes('vapi')) {
      try {
        const text = await resp.text();
        const idx = xhrCalls.findIndex(c => c.url === url);
        if (idx >= 0) {
          xhrCalls[idx].status = resp.status();
          xhrCalls[idx].contentType = contentType;
          xhrCalls[idx].bodyPreview = text.substring(0, 800);
        }
        if (contentType.includes('json') && text.length > 20) {
          try {
            const json = JSON.parse(text);
            jsonBodies.push({ url, data: json });
          } catch {}
        }
      } catch {}
    }
  });

  // Step 1: 访问搜索页建立会话
  console.log('Step 1: Visiting search page to establish session...');
  await page.goto('https://we.51job.com/pc/search?keyword=%E9%94%80%E5%94%AE&jobArea=010000&page=1&reportType=1', {
    waitUntil: 'networkidle2', timeout: 60000,
  });
  console.log('Search page loaded. Waiting for SPA to render...');
  await new Promise(r => setTimeout(r, 8000));

  // Step 2: 点击第一个职位卡片触发SPA内部导航到详情
  console.log('Step 2: Clicking first job card to trigger SPA detail navigation...');
  const clicked = await page.evaluate(() => {
    // 尝试多种选择器找到职位卡片链接
    const selectors = [
      '.joblist-item a', '.job-item a', '.job-card a',
      '[class*="job"] a[href*="detail"]', '.result-list a[href*="detail"]',
      'a[href*="/detail"]', '[class*="joblist"] a',
      '.joblist-item', '.job-item', '[class*="job-card"]',
      '.el-table__body tr', '.list-item', '[class*="result"] > div',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) {
        el.click();
        return `clicked: ${sel}`;
      }
    }
    return 'no clickable element found';
  });
  console.log(`Click result: ${clicked}`);
  console.log('Waiting for detail API calls...');
  await new Promise(r => setTimeout(r, 12000));

  // Step 3: 也尝试直接导航到 SPA 详情 URL
  console.log('Step 3: Direct navigation to SPA detail URL...');
  try {
    await page.goto('https://we.51job.com/pc/detail?jobId=155549199', {
      waitUntil: 'networkidle2', timeout: 30000,
    });
    console.log('SPA detail page loaded. Waiting for API calls...');
    await new Promise(r => setTimeout(r, 10000));
  } catch (e: any) {
    console.log(`Direct detail page navigation failed: ${e.message}`);
  }

  // Step 4: 尝试访问旧版服务端渲染详情页
  console.log('Step 4: Trying old server-rendered detail page...');
  try {
    await page.goto('https://jobs.51job.com/beijing/155549199.html', {
      waitUntil: 'networkidle2', timeout: 30000,
    });
    console.log('Old detail page loaded.');
    const html = await page.content();
    console.log(`HTML length: ${html.length}`);
    await new Promise(r => setTimeout(r, 5000));
  } catch (e: any) {
    console.log(`Old detail page failed: ${e.message}`);
  }

  // 输出所有拦截到的内容
  console.log('\n========== ALL XHR CALLS ==========');
  xhrCalls.forEach(c => {
    console.log(`[${c.status}] ${c.method} ${c.url.substring(0, 200)}`);
    if (c.bodyPreview) console.log(`  preview: ${c.bodyPreview.substring(0, 400)}`);
  });

  console.log('\n========== JSON RESPONSES ==========');
  jsonBodies.forEach(r => {
    console.log(`URL: ${r.url.substring(0, 200)}`);
    const keys = Array.isArray(r.data) ? `Array[${r.data.length}]` : Object.keys(r.data).join(', ');
    console.log(`Keys: ${keys}`);
    console.log(JSON.stringify(r.data).substring(0, 1500));
    console.log('---');
  });

  const outPath = 'D:/AICODEING/aitraining/code/debug/job51_detail_sniff_v3.json';
  fs.writeFileSync(outPath, JSON.stringify({ xhrCalls, jsonBodies }, null, 2));
  console.log(`\nSaved to ${outPath}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
