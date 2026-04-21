const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('='.repeat(80));
  console.log('智联招聘详情页诊断工具');
  console.log('='.repeat(80));
  
  // 使用之前提取的职位链接
  const jobUrl = 'http://www.zhaopin.com/jobdetail/CC347570330J40933614602.htm?refcode=4019&srccode=401903';
  
  console.log(`测试URL: ${jobUrl}`);
  console.log();
  
  let browser;
  
  try {
    console.log('启动浏览器...');
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    console.log('导航到详情页...');
    await page.goto(jobUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✓ 页面加载完成');
    console.log();
    
    // 等待动态内容加载
    console.log('等待5秒让动态内容加载...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 保存HTML快照
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const htmlContent = await page.content();
    const snapshotPath = path.join(debugDir, `zhilian_detail_${Date.now()}.html`);
    fs.writeFileSync(snapshotPath, htmlContent, 'utf-8');
    console.log(`✓ HTML快照已保存: ${snapshotPath}`);
    console.log();
    
    // 尝试提取职位详情
    console.log('尝试提取职位详情信息...');
    const jobDetail = await page.evaluate(() => {
      const detail = {};
      
      // ✅ 职位名称 - 从 h1.title 或 summary-planes__title 中提取
      const titleEl = document.querySelector('.summary-planes__title, h1.job-name, h1.title');
      detail.title = titleEl ? titleEl.textContent.trim() : '';
      
      // ✅ 薪资 - 从 summary-planes__salary 中提取
      const salaryEl = document.querySelector('.summary-planes__salary');
      detail.salary = salaryEl ? salaryEl.textContent.trim() : '';
      
      // ✅ 城市 - 从 workCity-link 或 summary-planes__info 第一个li中提取
      const cityEl = document.querySelector('.workCity-link');
      if (cityEl) {
        detail.city = cityEl.textContent.trim();
      } else {
        const firstInfoItem = document.querySelector('.summary-planes__info li a');
        if (firstInfoItem) {
          detail.city = firstInfoItem.textContent.trim();
        }
      }
      
      // ✅ 区域 - 从 summary-planes__info 第一个li的span中提取
      const areaEl = document.querySelector('.summary-planes__info li span');
      detail.area = areaEl ? areaEl.textContent.trim() : '';
      
      // ✅ 工作经验、学历、工作性质、招聘人数 - 从 summary-planes__info 中提取
      const infoItems = Array.from(document.querySelectorAll('.summary-planes__info li'));
      infoItems.forEach((item) => {
        const text = (item.textContent || '').trim();
        
        // 跳过已提取的城市链接
        if (item.querySelector('a')) return;
        
        // 判断是否为工作经验（包含"年"字）
        if (text.match(/\d+-?\d*年/)) {
          detail.experience = text;
        }
        // 判断是否为学历
        else if (text.match(/(本科|硕士|博士|大专|中专|高中|初中)/)) {
          detail.education = text;
        }
        // 判断是否为工作性质
        else if (text.match(/(全职|兼职|实习)/)) {
          detail.workType = text;
        }
        // 判断是否为招聘人数
        else if (text.match(/招\d+人/)) {
          const match = text.match(/招(\d+)人/);
          if (match) {
            detail.recruitmentCount = match[1] + '人';
          }
        }
      });
      
      // ✅ 职位描述 - 从 describtion-card__detail-content 中提取
      const descEl = document.querySelector('.describtion-card__detail-content');
      if (descEl) {
        // 将<br>替换为换行符，然后清理HTML标签
        let description = descEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        // 移除所有HTML标签
        description = description.replace(/<[^>]+>/g, '');
        // 清理多余空白
        description = description.replace(/\s+/g, ' ').trim();
        detail.description = description;
      }
      
      // ✅ 工作地址 - 从 address-info__bubble 中提取
      const addressEl = document.querySelector('.address-info__bubble');
      detail.address = addressEl ? addressEl.textContent.trim() : '';
      
      // ✅ 公司名称 - 从 company-info__name 中提取
      const companyEl = document.querySelector('.company-info__name');
      detail.company = companyEl ? companyEl.textContent.trim() : '';
      
      // ✅ 公司信息 - 从 company-info__desc 中提取（融资状态 · 规模 · 行业）
      const companyDescEl = document.querySelector('.company-info__desc');
      if (companyDescEl) {
        const companyText = (companyDescEl.textContent || '').trim();
        // 解析：未融资 · 500-999人 · 计算机软件、IT服务
        const parts = companyText.split('·').map(p => p.trim());
        if (parts.length >= 1) {
          detail.companyNature = parts[0]; // 融资状态/公司性质
        }
        if (parts.length >= 2) {
          detail.companyScale = parts[1];  // 公司规模
        }
        if (parts.length >= 3) {
          detail.businessScope = parts.slice(2).join(', '); // 经营范围
        }
      }
      
      // ✅ 岗位更新日期 - 从 summary-planes__time 中提取
      const updateEl = document.querySelector('.summary-planes__time');
      if (updateEl) {
        const updateTimeText = updateEl.textContent.trim();
        // 提取"更新于 今天"、"更新于 3天前"等
        const timeMatch = updateTimeText.match(/更新于\s*(.+)/);
        if (timeMatch) {
          detail.updateDateText = timeMatch[1].trim();
        }
      }
      
      // ✅ 职位标签/技能要求 - 从 describtion-card__skills-item 中提取
      const skillItems = Array.from(document.querySelectorAll('.describtion-card__skills-item'));
      if (skillItems.length > 0) {
        detail.jobTags = skillItems.map(item => item.textContent.trim()).join(',');
      }
      
      return detail;
    });
    
    console.log();
    console.log('提取到的职位详情:');
    console.log('─'.repeat(80));
    console.log(`职位名称: ${jobDetail.title || '❌ 未找到'}`);
    console.log(`公司名称: ${jobDetail.company || '❌ 未找到'}`);
    console.log(`薪资范围: ${jobDetail.salary || '❌ 未找到'}`);
    console.log(`工作城市: ${jobDetail.city || '❌ 未找到'}`);
    console.log(`所在区域: ${jobDetail.area || '未找到'}`);
    console.log(`工作经验: ${jobDetail.experience || '❌ 未找到'}`);
    console.log(`学历要求: ${jobDetail.education || '❌ 未找到'}`);
    console.log(`工作性质: ${jobDetail.workType || '❌ 未找到'}`);
    console.log(`招聘人数: ${jobDetail.recruitmentCount || '❌ 未找到'}`);
    console.log(`工作地址: ${jobDetail.address || '❌ 未找到'}`);
    console.log(`公司性质: ${jobDetail.companyNature || '❌ 未找到'}`);
    console.log(`公司规模: ${jobDetail.companyScale || '❌ 未找到'}`);
    console.log(`经营范围: ${jobDetail.businessScope || '❌ 未找到'}`);
    console.log(`更新时间: ${jobDetail.updateDateText || '❌ 未找到'}`);
    console.log(`职位标签: ${jobDetail.jobTags || '❌ 未找到'}`);
    console.log();
    console.log('职位描述（前500字符）:');
    console.log(jobDetail.description ? jobDetail.description.substring(0, 500) : '❌ 未找到');
    console.log('─'.repeat(80));
    console.log();
    
    // 搜索可能的CSS类名
    console.log('搜索页面中可能包含职位信息的CSS类名...');
    const classNames = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const classSet = new Set();
      
      allElements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(/\s+/);
          classes.forEach(cls => {
            if (cls.match(/job|position|salary|experience|education|address|description|company/i)) {
              classSet.add(cls);
            }
          });
        }
      });
      
      return Array.from(classSet).sort();
    });
    
    console.log(`找到 ${classNames.length} 个相关类名:`);
    classNames.slice(0, 50).forEach(cls => {
      console.log(`  - ${cls}`);
    });
    console.log();
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
  
  console.log('='.repeat(80));
  console.log('诊断完成');
  console.log('='.repeat(80));
})();
