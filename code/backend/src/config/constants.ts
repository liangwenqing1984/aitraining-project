// CSV字段定义（按顺序）
export const CSV_FIELDS = [
  '职位ID',
  '职位名称',
  '职位标签',
  '职位描述',
  '薪资范围',
  '工作城市',
  '工作经验',
  '工作地址',
  '学历',
  '公司代码',
  '公司性质',
  '经营范围',
  '公司规模',
  '岗位招聘人数',
  '岗位更新日期',
  '工作性质',
  '数据来源'
];

// CSV字段映射（英文->中文）
export const CSV_FIELD_MAP: Record<string, string> = {
  jobId: '职位ID',
  jobName: '职位名称',
  jobTags: '职位标签',
  jobDescription: '职位描述',
  salaryRange: '薪资范围',
  workCity: '工作城市',
  workExperience: '工作经验',
  workAddress: '工作地址',
  education: '学历',
  companyCode: '公司代码',
  companyNature: '公司性质',
  businessScope: '经营范围',
  companyScale: '公司规模',
  recruitmentCount: '岗位招聘人数',
  updateDate: '岗位更新日期',
  workType: '工作性质',
  dataSource: '数据来源'
};

// 智联招聘城市编码
export const ZHILIAN_CITY_CODES: Record<string, string> = {
  '北京': '530',
  '上海': '538',
  '广州': '765',
  '深圳': '765',
  '杭州': '653',
  '成都': '801',
  '武汉': '736',
  '南京': '635',
  '西安': '854',
  '重庆': '854',
  '天津': '531',
  '苏州': '636',
  '郑州': '719',
  '长沙': '749',
  '东莞': '763',
  '沈阳': '565',
  '青岛': '609',
  '合肥': '654',
  '佛山': '763'
};

// 前程无忧城市编码
export const JOB51_CITY_CODES: Record<string, string> = {
  '北京': '010000',
  '上海': '020000',
  '广州': '030200',
  '深圳': '040000',
  '杭州': '080200',
  '成都': '090200',
  '武汉': '180200',
  '南京': '070200',
  '西安': '200200',
  '重庆': '060000',
  '天津': '050000',
  '苏州': '070300',
  '郑州': '170200',
  '长沙': '190200',
  '东莞': '030800',
  '沈阳': '110200',
  '青岛': '120300',
  '合肥': '150200',
  '佛山': '030700'
};

// 省市数据
export const REGIONS = [
  {
    code: '110000',
    name: '北京',
    cities: [{ code: '110100', name: '北京' }]
  },
  {
    code: '310000',
    name: '上海',
    cities: [{ code: '310100', name: '上海' }]
  },
  {
    code: '440000',
    name: '广东',
    cities: [
      { code: '440100', name: '广州' },
      { code: '440300', name: '深圳' },
      { code: '440600', name: '佛山' },
      { code: '441900', name: '东莞' }
    ]
  },
  {
    code: '330000',
    name: '浙江',
    cities: [
      { code: '330100', name: '杭州' },
      { code: '330200', name: '宁波' }
    ]
  },
  {
    code: '510000',
    name: '四川',
    cities: [{ code: '510100', name: '成都' }]
  },
  {
    code: '420000',
    name: '湖北',
    cities: [{ code: '420100', name: '武汉' }]
  },
  {
    code: '320000',
    name: '江苏',
    cities: [
      { code: '320100', name: '南京' },
      { code: '320500', name: '苏州' }
    ]
  },
  {
    code: '610000',
    name: '陕西',
    cities: [{ code: '610100', name: '西安' }]
  },
  {
    code: '500000',
    name: '重庆',
    cities: [{ code: '500100', name: '重庆' }]
  },
  {
    code: '120000',
    name: '天津',
    cities: [{ code: '120100', name: '天津' }]
  },
  {
    code: '410000',
    name: '河南',
    cities: [{ code: '410100', name: '郑州' }]
  },
  {
    code: '430000',
    name: '湖南',
    cities: [{ code: '430100', name: '长沙' }]
  },
  {
    code: '210000',
    name: '辽宁',
    cities: [{ code: '210100', name: '沈阳' }]
  },
  {
    code: '370000',
    name: '山东',
    cities: [{ code: '370200', name: '青岛' }]
  },
  {
    code: '340000',
    name: '安徽',
    cities: [{ code: '340100', name: '合肥' }]
  }
];
