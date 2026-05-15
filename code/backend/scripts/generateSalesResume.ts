import * as fs from 'fs';
import * as path from 'path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType,
} from 'docx';

async function main() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: '个人简历',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // ==================== 基本信息 ====================
          new Paragraph({
            text: '基本信息',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          }),
          createInfoRow('姓名：', '王建国'),
          createInfoRow('电话：', '139****6789'),
          createInfoRow('邮箱：', 'wangjianguo@example.com'),
          createInfoRow('工作年限：', '8年'),
          createInfoRow('最高学历：', '本科'),
          createInfoRow('毕业院校：', '上海对外经贸大学 市场营销专业'),
          createInfoRow('期望城市：', '上海'),
          createInfoRow('期望职位：', '大客户销售总监 / 区域销售经理'),
          createInfoRow('期望薪资：', '25K-35K'),
          createInfoRow('工作类型：', '全职'),

          // ==================== 技能栈 ====================
          new Paragraph({
            text: '专业技能',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '销售管理：', bold: true }),
              new TextRun({ text: '精通 B2B 大客户销售全流程管理，擅长销售漏斗搭建与商机管理；具备丰富的招投标经验，累计中标金额超8000万元。' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '客户关系：', bold: true }),
              new TextRun({ text: '擅长高层客户关系经营，具备 C-level 决策链突破能力；熟练使用 Salesforce、纷享销客等 CRM 系统进行客户全生命周期管理。' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '行业知识：', bold: true }),
              new TextRun({ text: '深耕企业服务/SaaS 领域6年，熟悉 ERP、CRM、OA、HRM 等企业软件产品；对制造业、零售、金融等行业数字化转型有深入理解。' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '商务谈判：', bold: true }),
              new TextRun({ text: '具备优秀的商务谈判和合同把控能力，擅长制定差异化竞争策略；平均项目毛利率维持在45%以上。' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '团队管理：', bold: true }),
              new TextRun({ text: '3年销售团队管理经验，曾带领8人销售团队连续两年超额完成业绩目标；擅长销售人才培养与激励。' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '语言能力：', bold: true }),
              new TextRun({ text: '英语 CET-6，可进行商务英语沟通和英文方案演示；普通话二级甲等。' }),
            ],
          }),

          // ==================== 工作经历 ====================
          new Paragraph({
            text: '工作经历',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),

          // 经历1
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '上海XX信息科技有限公司（2021.04 - 至今）', bold: true }),
              new TextRun({ text: '    大客户销售总监', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: '所属行业：企业服务/SaaS', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: '工作职责与业绩：' }),
            ],
          }),
          createBullet('负责华东区域大客户销售工作，聚焦制造业和零售行业头部客户，年度销售配额2000万元；'),
          createBullet('2023年个人签约金额2800万元，完成率140%，获公司"年度销售冠军"；'),
          createBullet('成功突破上汽集团、光明食品、百联集团等10+家行业头部客户，平均客单价120万元；'),
          createBullet('主导某大型零售集团全渠道数字化项目（合同额650万元），协调售前、交付、产品团队完成方案设计和POC验证；'),
          createBullet('建立并维护客户高层关系网络，客户续约率达到92%，NPS评分85分以上；'),
          createBullet('管理8人销售团队，建立周复盘和商机评审机制，团队人效提升35%。'),

          // 经历2
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({ text: '杭州YY科技有限公司（2018.03 - 2021.03）', bold: true }),
              new TextRun({ text: '    大客户经理', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: '所属行业：云计算/大数据', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: '工作职责与业绩：' }),
            ],
          }),
          createBullet('负责浙江省区域内中大型企业客户的云服务和数据中台产品销售；'),
          createBullet('连续3年超额完成销售指标（达成率分别为125%、138%、152%），累计签约金额4200万元；'),
          createBullet('独立拓展并签约吉利汽车、海康威视数据平台项目（合同额380万元），成为公司标杆案例；'),
          createBullet('协同渠道合作伙伴（代理商/SI）共同推进项目，渠道贡献占比35%；'),
          createBullet('多次参与行业峰会和 CIO 闭门会做主题分享，建立个人和公司在区域的品牌影响力。'),

          // 经历3
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({ text: '深圳ZZ软件股份有限公司（2016.07 - 2018.02）', bold: true }),
              new TextRun({ text: '    销售代表', bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: '所属行业：企业软件/ERP', bold: true }),
            ],
          }),
          createBullet('负责华南区中小型制造企业的 ERP 软件销售，通过电话+拜访模式开拓新客户；'),
          createBullet('入职第一年签约客户18家，合同总额360万元，获公司"最佳新人奖"；'),
          createBullet('积累了大量制造业客户资源，深入了解工厂生产管理、供应链管理等核心痛点；'),
          createBullet('协助售前顾问进行产品演示和方案讲解，提升个人解决方案销售能力。'),

          // ==================== 项目经验 ====================
          new Paragraph({
            text: '重点项目',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),

          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '某大型零售集团全渠道数字化项目（2023.05 - 2023.12）', bold: true }),
            ],
          }),
          createBullet('合同金额：650万元'),
          createBullet('项目背景：客户拥有2000+线下门店和多个电商渠道，需要打通线上线下会员、订单、库存数据，构建统一的中台系统。'),
          createBullet('个人角色：项目总负责人，统筹售前、交付、产品共12人团队。'),
          createBullet('关键动作：深入调研客户业务痛点，制定三阶段实施方案；通过多轮技术交流和POC验证赢得客户信任；在竞标中击败2家头部友商。'),
          createBullet('项目成果：成功交付一期和二期，客户追加三期合同（+280万元），成为公司零售行业标杆案例。'),

          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [
              new TextRun({ text: '吉利汽车数据中台项目（2019.08 - 2020.03）', bold: true }),
            ],
          }),
          createBullet('合同金额：380万元'),
          createBullet('项目背景：客户需要整合研发、生产、供应链、营销等各业务系统数据，构建统一的数据分析平台。'),
          createBullet('个人角色：商机发掘+商务推进负责人。'),
          createBullet('关键动作：通过行业会议接触客户CIO，持续跟进7个月；协调公司数据科学家团队为客户做了3次免费数据诊断报告，建立信任。'),
          createBullet('项目成果：成功签约，项目上线后客户数据查询效率提升10倍，获客户书面感谢信。'),

          // ==================== 证书与培训 ====================
          new Paragraph({
            text: '证书与培训',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          createBullet('Salesforce 认证管理员（Salesforce Certified Administrator）'),
          createBullet('SPIN 销售技巧认证培训'),
          createBullet('CET-6 英语六级（580分）'),
          createBullet('全国计算机等级考试二级（MS Office高级应用）'),

          // ==================== 自我评价 ====================
          new Paragraph({
            text: '自我评价',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: '8年B2B销售经验，其中3年销售团队管理经验。深耕企业服务/SaaS领域，对制造业、零售行业数字化转型有深刻的业务理解和丰富的客户资源。擅长顾问式销售和解决方案销售，具备从商机挖掘到签约回款的全流程把控能力。有强烈的目标感和自驱力，善于在高压力环境下达成业绩目标。具备良好的跨部门协调能力，能有效整合售前、产品、交付资源服务客户。职业发展期望：在销售管理方向持续深耕，成长为能够带领更大规模销售团队的业务负责人。' }),
            ],
          }),
        ],
      },
    ],
  });

  const outDir = path.resolve(__dirname, '../../data/resume_samples');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, '王建国_B2B销售总监8年_简历样例.docx');

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log(`简历样例已生成: ${outPath}`);
  console.log(`文件大小: ${(buffer.length / 1024).toFixed(1)} KB`);
}

function createInfoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function createBullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 400 },
    children: [new TextRun({ text: '•  ' + text })],
  });
}

main().catch(console.error);
