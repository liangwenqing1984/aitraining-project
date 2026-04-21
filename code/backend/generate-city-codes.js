/**
 * 智联招聘城市代码生成工具 - 基于已知规律推测
 * 
 * 原理：根据已知的黑龙江城市代码（622-634），结合行政区划和代码连续性规律，
 *       推测其他省份的城市代码
 * 
 * 使用方法：node generate-city-codes.js
 */

const fs = require('fs');
const path = require('path');

// 已知的基准数据
const KNOWN_CODES = {
  // 黑龙江省（已验证，连续代码）
  '哈尔滨': '622',
  '齐齐哈尔': '623',
  '鸡西': '624',
  '鹤岗': '625',
  '双鸭山': '626',
  '大庆': '627',
  '伊春': '628',
  '佳木斯': '629',
  '七台河': '630',
  '牡丹江': '631',
  '黑河': '632',
  '绥化': '633',
  '大兴安岭': '634',
};

// 中国主要城市列表（按省份分组，用于推测代码）
const PROVINCE_CITIES = {
  '直辖市': [
    { name: '北京', estimatedCode: 530 },
    { name: '天津', estimatedCode: 531 },
    { name: '上海', estimatedCode: 538 },
    { name: '重庆', estimatedCode: 532 },
  ],
  '东北三省': [
    // 辽宁省（估计在565-580之间）
    { name: '沈阳', estimatedCode: 565 },
    { name: '大连', estimatedCode: 566 },
    { name: '鞍山', estimatedCode: 567 },
    { name: '抚顺', estimatedCode: 568 },
    { name: '本溪', estimatedCode: 569 },
    { name: '丹东', estimatedCode: 570 },
    { name: '锦州', estimatedCode: 571 },
    { name: '营口', estimatedCode: 572 },
    { name: '阜新', estimatedCode: 573 },
    { name: '辽阳', estimatedCode: 574 },
    { name: '盘锦', estimatedCode: 575 },
    { name: '铁岭', estimatedCode: 576 },
    { name: '朝阳', estimatedCode: 577 },
    { name: '葫芦岛', estimatedCode: 578 },
    
    // 吉林省（估计在621, 640-650之间）
    { name: '长春', estimatedCode: 621 },
    { name: '吉林', estimatedCode: 640 },
    { name: '四平', estimatedCode: 641 },
    { name: '辽源', estimatedCode: 642 },
    { name: '通化', estimatedCode: 643 },
    { name: '白山', estimatedCode: 644 },
    { name: '松原', estimatedCode: 645 },
    { name: '白城', estimatedCode: 646 },
    { name: '延边', estimatedCode: 647 },
  ],
  '华北地区': [
    { name: '石家庄', estimatedCode: 561 },
    { name: '唐山', estimatedCode: 561 },
    { name: '秦皇岛', estimatedCode: 561 },
    { name: '太原', estimatedCode: 563 },
    { name: '大同', estimatedCode: 563 },
    { name: '呼和浩特', estimatedCode: 562 },
    { name: '包头', estimatedCode: 562 },
  ],
  '华东地区': [
    // 山东省
    { name: '济南', estimatedCode: 609 },
    { name: '青岛', estimatedCode: 610 },
    { name: '淄博', estimatedCode: 611 },
    { name: '烟台', estimatedCode: 612 },
    
    // 江苏省
    { name: '南京', estimatedCode: 635 },
    { name: '苏州', estimatedCode: 636 },
    { name: '无锡', estimatedCode: 637 },
    { name: '常州', estimatedCode: 638 },
    
    // 浙江省
    { name: '杭州', estimatedCode: 653 },
    { name: '宁波', estimatedCode: 654 },
    { name: '温州', estimatedCode: 655 },
    
    // 福建省
    { name: '福州', estimatedCode: 660 },
    { name: '厦门', estimatedCode: 661 },
    { name: '泉州', estimatedCode: 662 },
    
    // 安徽省
    { name: '合肥', estimatedCode: 654 },
    { name: '芜湖', estimatedCode: 655 },
  ],
  '华中地区': [
    // 河南省
    { name: '郑州', estimatedCode: 719 },
    { name: '洛阳', estimatedCode: 720 },
    { name: '开封', estimatedCode: 721 },
    
    // 湖北省
    { name: '武汉', estimatedCode: 736 },
    { name: '宜昌', estimatedCode: 737 },
    { name: '襄阳', estimatedCode: 738 },
    
    // 湖南省
    { name: '长沙', estimatedCode: 749 },
    { name: '株洲', estimatedCode: 750 },
    { name: '湘潭', estimatedCode: 751 },
  ],
  '华南地区': [
    // 广东省
    { name: '广州', estimatedCode: 765 },
    { name: '深圳', estimatedCode: 765 },
    { name: '东莞', estimatedCode: 763 },
    { name: '佛山', estimatedCode: 763 },
    { name: '珠海', estimatedCode: 765 },
    { name: '中山', estimatedCode: 763 },
    { name: '惠州', estimatedCode: 763 },
    { name: '汕头', estimatedCode: 763 },
    
    // 广西
    { name: '南宁', estimatedCode: 751 },
    { name: '柳州', estimatedCode: 752 },
    { name: '桂林', estimatedCode: 753 },
  ],
  '西南地区': [
    // 四川省
    { name: '成都', estimatedCode: 801 },
    { name: '绵阳', estimatedCode: 802 },
    { name: '德阳', estimatedCode: 803 },
    
    // 云南省
    { name: '昆明', estimatedCode: 805 },
    { name: '曲靖', estimatedCode: 806 },
    
    // 贵州省
    { name: '贵阳', estimatedCode: 803 },
    { name: '遵义', estimatedCode: 804 },
  ],
  '西北地区': [
    // 陕西省
    { name: '西安', estimatedCode: 854 },
    { name: '咸阳', estimatedCode: 855 },
    
    // 甘肃省
    { name: '兰州', estimatedCode: 856 },
    
    // 新疆
    { name: '乌鲁木齐', estimatedCode: 858 },
  ],
};

function generateCityCodes() {
  console.log('🚀 开始生成智联招聘城市代码映射表...\n');
  
  const allCities = {};
  
  // 添加已知的城市代码
  Object.entries(KNOWN_CODES).forEach(([city, code]) => {
    allCities[city] = code;
  });
  
  // 添加推测的城市代码
  for (const [region, cities] of Object.entries(PROVINCE_CITIES)) {
    console.log(`📍 ${region}:`);
    cities.forEach(({ name, estimatedCode }) => {
      if (!allCities[name]) {
        allCities[name] = estimatedCode.toString();
        console.log(`   ${name.padEnd(10)}: ${estimatedCode} (推测)`);
      }
    });
    console.log('');
  }
  
  // 按代码排序
  const sortedCities = Object.entries(allCities).sort((a, b) => 
    parseInt(a[1]) - parseInt(b[1])
  );
  
  // 生成TypeScript代码
  let tsCode = '/**\n';
  tsCode += ' * 智联招聘城市代码映射表\n';
  tsCode += ` * 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  tsCode += ' * \n';
  tsCode += ' * 说明:\n';
  tsCode += ' * - 黑龙江省城市代码（622-634）已通过实际测试验证 ✅\n';
  tsCode += ' * - 其他城市代码为基于规律的推测值 ⚠️\n';
  tsCode += ' * - 建议逐步测试并修正不准确的代码\n';
  tsCode += ' */\n\n';
  tsCode += 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
  
  // 按省份分组输出
  let currentRegion = '';
  sortedCities.forEach(([city, code], index) => {
    const comma = index < sortedCities.length - 1 ? ',' : '';
    
    // 添加省份注释
    const region = getRegionForCity(city);
    if (region && region !== currentRegion) {
      tsCode += `\n  // ===== ${region} =====\n`;
      currentRegion = region;
    }
    
    const isKnown = KNOWN_CODES[city] !== undefined;
    const marker = isKnown ? ' ✅' : ' ⚠️';
    tsCode += `  '${city}': '${code}'${comma}${marker}\n`;
  });
  
  tsCode += '};\n';
  
  // 保存文件
  const outputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-generated.ts');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, tsCode, 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 生成完成！\n');
  console.log(`💾 已保存到: ${outputPath}\n`);
  console.log(`📊 总计: ${sortedCities.length} 个城市`);
  console.log(`   - 已验证: ${Object.keys(KNOWN_CODES).length} 个`);
  console.log(`   - 推测值: ${sortedCities.length - Object.keys(KNOWN_CODES).length} 个\n`);
  
  console.log('⚠️  重要提示:');
  console.log('   1. 黑龙江省代码已验证，其他为推测值');
  console.log('   2. 请优先测试常用城市的代码准确性');
  console.log('   3. 发现错误代码时请及时修正并记录');
  console.log('   4. 可以将此文件内容合并到 constants.ts 中\n');
}

function getRegionForCity(cityName) {
  for (const [region, cities] of Object.entries(PROVINCE_CITIES)) {
    if (cities.some(c => c.name === cityName)) {
      return region;
    }
  }
  if (KNOWN_CODES[cityName]) {
    return '黑龙江省（已验证）';
  }
  return '其他地区';
}

// 执行
generateCityCodes();
