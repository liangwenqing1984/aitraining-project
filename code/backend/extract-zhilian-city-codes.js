/**
 * 智联招聘城市代码提取工具
 * 
 * 使用方法：
 * 1. 访问 https://www.zhaopin.com/citymap.html
 * 2. 在浏览器控制台运行此脚本
 * 3. 复制输出的JSON到 constants.ts
 */

// 方法1: 从城市选择页面提取
function extractCityCodesFromPage() {
  const cityMap = {};
  
  // 查找所有城市链接
  const cityLinks = document.querySelectorAll('a[href*="/sou/jl"]');
  
  cityLinks.forEach(link => {
    const href = link.href;
    const match = href.match(/jl(\d+)/);
    
    if (match) {
      const cityCode = match[1];
      const cityName = link.textContent.trim();
      
      if (cityName && !cityMap[cityName]) {
        cityMap[cityName] = cityCode;
      }
    }
  });
  
  console.log('提取到的城市代码:', JSON.stringify(cityMap, null, 2));
  return cityMap;
}

// 方法2: 通过API获取（如果可用）
async function fetchCityCodesFromAPI() {
  try {
    // 尝试调用智联招聘的城市API
    const response = await fetch('https://fe-api.zhaopin.com/c/i/sou?pageSize=1&cityId=0');
    const data = await response.json();
    
    console.log('API返回数据:', data);
    return data;
  } catch (error) {
    console.error('API调用失败:', error);
  }
}

// 执行提取
console.log('开始提取城市代码...');
extractCityCodesFromPage();
