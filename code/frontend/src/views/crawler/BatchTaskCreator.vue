<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCrawlerStore } from '@/stores/crawler'
import { type TaskConfig } from '@/api/task'
import { Upload, Download } from '@element-plus/icons-vue'

const router = useRouter()
const crawlerStore = useCrawlerStore()

// 配置参数
const BATCH_SIZE = 50  // 每批企业数量
const MAX_CONCURRENT = 5  // 最大并发任务数
const MAX_KEYWORDS = 100  // 🔧 最大关键词数量（从50提升到100）
const MAX_COMPANIES = 3000  // 🔧 最大企业数量（从100提升到3000，支持大规模企业筛选）

// 表单数据
const taskName = ref('')
const sites = ref<('zhilian' | '51job')[]>([])  // 🔧 添加数据来源选择
const keywords = ref<string[]>([])
const keywordInput = ref('')
const cities = ref<string[]>([])
const selectedProvince = ref('')
const maxPages = ref(50)  // 🔧 修改默认值为50

// 企业列表
const companyText = ref('')
const parsedCompanies = ref<string[]>([])

// 省份和城市数据（完整版，与CreateTask保持一致）
const provinces = [
  { value: 'beijing', label: '北京' },
  { value: 'shanghai', label: '上海' },
  { value: 'guangdong', label: '广东' },
  { value: 'jiangsu', label: '江苏' },
  { value: 'zhejiang', label: '浙江' },
  { value: 'sichuan', label: '四川' },
  { value: 'hubei', label: '湖北' },
  { value: 'hunan', label: '湖南' },
  { value: 'henan', label: '河南' },
  { value: 'anhui', label: '安徽' },
  { value: 'fujian', label: '福建' },
  { value: 'jiangxi', label: '江西' },
  { value: 'shandong', label: '山东' },
  { value: 'hebei', label: '河北' },
  { value: 'shannxi', label: '陕西' },
  { value: 'gansu', label: '甘肃' },
  { value: 'qinghai', label: '青海' },
  { value: 'ningxia', label: '宁夏' },
  { value: 'xinjiang', label: '新疆' },
  { value: 'xizang', label: '西藏' },
  { value: 'neimenggu', label: '内蒙古' },
  { value: 'guangxi', label: '广西' },
  { value: 'guizhou', label: '贵州' },
  { value: 'yunnan', label: '云南' },
  { value: 'hainan', label: '海南' },
  { value: 'tianjin', label: '天津' },
  { value: 'chongqing', label: '重庆' },
  { value: 'heilongjiang', label: '黑龙江' },
  { value: 'jilin', label: '吉林' },
  { value: 'liaoning', label: '辽宁' },
  { value: 'shanxi', label: '山西' }
]

const citiesMap: { [key: string]: string[] } = {
  beijing: ['北京'],
  shanghai: ['上海'],
  guangdong: ['广州', '深圳', '珠海', '佛山', '东莞', '中山', '惠州', '江门', '汕头', '肇庆', '阳江', '湛江', '茂名', '清远', '韶关', '梅州', '汕尾', '河源', '潮州', '揭阳', '云浮'],
  jiangsu: ['南京', '苏州', '无锡', '常州', '镇江', '南通', '扬州', '泰州', '盐城', '淮安', '连云港', '宿迁', '徐州'],
  zhejiang: ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'],
  sichuan: ['成都', '绵阳', '德阳', '广元', '自贡', '攀枝花', '泸州', '德阳', '广安', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳'],
  hubei: ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施', '仙桃', '潜江', '天门', '神农架'],
  hunan: ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'],
  henan: ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
  anhui: ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
  fujian: ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
  jiangxi: ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
  shandong: ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '莱芜', '临沂', '德州', '聊城', '滨州', '菏泽'],
  hebei: ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
  shannxi: ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
  gansu: ['兰州', '嘉峪关', '金昌', '白银', '天水', '酒泉', '张掖', '武威', '庆阳', '平凉', '定西', '陇南', '临夏', '甘南'],
  qinghai: ['西宁', '海东', '海北', '黄南', '海南', '果洛', '玉树', '海西'],
  ningxia: ['银川', '石嘴山', '吴忠', '固原', '中卫'],
  xinjiang: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '阿克苏', '喀什', '和田', '昌吉', '博尔塔拉', '巴音郭楞', '克孜勒苏', '伊犁', '塔城', '阿勒泰'],
  xizang: ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'],
  neimenggu: ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安', '锡林郭勒', '阿拉善'],
  guangxi: ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
  guizhou: ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'],
  yunnan: ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'],
  hainan: ['海口', '三亚', '三沙', '儋州', '五指山', '琼海', '文昌', '万宁', '东方', '定安', '屯昌', '澄迈', '临高', '白沙', '昌江', '乐东', '陵水', '保亭', '琼中'],
  tianjin: ['天津'],
  chongqing: ['重庆'],
  heilongjiang: ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭'],
  jilin: ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'],
  liaoning: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
  shanxi: ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁']
}

// 计算属性
const totalBatches = computed(() => {
  if (parsedCompanies.value.length === 0) return 1  // 🔧 无企业名单时创建1个任务
  return Math.ceil(parsedCompanies.value.length / BATCH_SIZE)
})
const estimatedTime = computed(() => {
  const minutesPerTask = 30
  const concurrentTasks = Math.min(totalBatches.value, MAX_CONCURRENT)
  return Math.ceil((totalBatches.value * minutesPerTask) / concurrentTasks / 60)
})

// 🔧 判断是否有企业名单
const hasCompanyList = computed(() => parsedCompanies.value.length > 0)

// 省份切换处理
function handleProvinceChange() {
  cities.value = []  // 切换省份时清空已选城市
}

// 解析企业列表
function parseCompanies() {
  const separators = /[,\uff0c;；\n\r]+/
  const list = companyText.value
    .split(separators)
    .map(c => c.trim())
    .filter(c => c.length > 0)
  
  // 🔧 去重
  const uniqueList = [...new Set(list)]
  
  // 🔧 检查是否超过上限
  if (uniqueList.length > MAX_COMPANIES) {
    ElMessage.warning(`企业名称数量超限！最多支持 ${MAX_COMPANIES} 家，当前输入 ${uniqueList.length} 家。将自动截断为前 ${MAX_COMPANIES} 家。`)
    parsedCompanies.value = uniqueList.slice(0, MAX_COMPANIES)
  } else {
    parsedCompanies.value = uniqueList
  }
  
  if (parsedCompanies.value.length === 0) {
    // 🔧 企业名单为空时不再警告，允许继续
    ElMessage.info('未填写企业名单，将搜索所有企业的职位')
  } else {
    ElMessage.success(`成功解析 ${parsedCompanies.value.length} 家企业，将分为 ${totalBatches.value} 批`)
  }
}

// 添加关键词（支持批量输入，上限100个）
function addKeyword() {
  const inputValue = keywordInput.value.trim()
  if (!inputValue) return
  
  // 支持多种分隔符：逗号、顿号、分号、空格
  const separators = /[,\uff0c;；\s]+/
  let newKeywords = inputValue
    .split(separators)
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0)
  
  // 🔧 单次输入上限：防止超大文本导致性能问题
  const MAX_SINGLE_INPUT = 100
  if (newKeywords.length > MAX_SINGLE_INPUT) {
    ElMessage.warning(`单次输入关键词数量过多（${newKeywords.length}个），最多支持 ${MAX_SINGLE_INPUT} 个，将自动截断`)
    newKeywords = newKeywords.slice(0, MAX_SINGLE_INPUT)
  }
  
  // 🔧 去重：过滤已存在的关键词
  const uniqueKeywords = newKeywords.filter(kw => !keywords.value.includes(kw))
  
  if (uniqueKeywords.length === 0) {
    ElMessage.warning('输入的关键词均已存在，请尝试其他关键词')
    return
  }
  
  // 🔧 限制最大关键词数量为100
  const remainingSlots = MAX_KEYWORDS - keywords.value.length
  
  if (remainingSlots <= 0) {
    ElMessage.warning(`关键词数量已达上限（${MAX_KEYWORDS}个），请先删除部分关键词`)
    return
  }
  
  // 如果新关键词超过剩余名额，只添加前面的部分
  const keywordsToAdd = uniqueKeywords.slice(0, remainingSlots)
  const skippedCount = uniqueKeywords.length - keywordsToAdd.length
  const duplicateCount = newKeywords.length - uniqueKeywords.length
  
  // 批量添加
  keywords.value.push(...keywordsToAdd)
  keywordInput.value = ''
  
  // 🔧 优化提示消息：更详细友好的反馈
  const parts = []
  parts.push(`已添加 ${keywordsToAdd.length} 个关键词`)
  
  if (duplicateCount > 0) {
    parts.push(`跳过 ${duplicateCount} 个重复`)
  }
  if (skippedCount > 0) {
    parts.push(`超出上限跳过 ${skippedCount} 个`)
  }
  
  if (keywordsToAdd.length === 1 && duplicateCount === 0 && skippedCount === 0) {
    // 单个添加
    ElMessage.success(`已添加: ${keywordsToAdd[0]}`)
  } else {
    // 批量添加
    ElMessage.success(parts.join('，'))
  }
}

function removeKeyword(index: number) {
  keywords.value.splice(index, 1)
}

function toggleCity(city: string) {
  const index = cities.value.indexOf(city)
  if (index > -1) {
    cities.value.splice(index, 1)
  } else {
    cities.value.push(city)
  }
}

// 从文件导入
function handleFileImport(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    companyText.value = text
    parseCompanies()
  }
  reader.readAsText(file)
}

// 下载模板
function downloadTemplate() {
  const template = `阿里巴巴
腾讯科技
字节跳动
百度在线
...`
  const blob = new Blob([template], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '企业名单模板.txt'
  link.click()
  window.URL.revokeObjectURL(url)
}

// 创建批量任务
async function createBatchTasks() {
  // 🔧 验证数据来源
  if (sites.value.length === 0) {
    ElMessage.warning('请至少选择一个数据来源（智联招聘或前程无忧）')
    return
  }
  if (!taskName.value.trim()) {
    ElMessage.warning('请输入任务名称前缀')
    return
  }
  if (keywords.value.length === 0) {
    ElMessage.warning('请至少添加一个职位关键词')
    return
  }
  if (cities.value.length === 0) {
    ElMessage.warning('请至少选择一个城市')
    return
  }
  
  // 🔧 企业名单改为可选，不再强制要求
  
  // 🔧 根据是否有企业名单显示不同的确认信息
  let confirmMessage: string
  if (hasCompanyList.value) {
    confirmMessage = `即将创建 ${totalBatches.value} 个任务（按企业批次），预计耗时 ${estimatedTime.value} 小时。是否继续？`
  } else {
    confirmMessage = `即将创建 1 个任务（不限制企业），预计耗时 ${estimatedTime.value} 小时。是否继续？`
  }
  
  try {
    await ElMessageBox.confirm(
      confirmMessage,
      hasCompanyList.value ? '批量创建任务' : '创建任务',
      {
        confirmButtonText: '开始创建',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  
  let successCount = 0
  let failCount = 0
  
  // 🔧 根据是否有企业名单采用不同的创建逻辑
  if (hasCompanyList.value) {
    // 有企业名单：按批次创建多个任务
    for (let i = 0; i < parsedCompanies.value.length; i += BATCH_SIZE) {
      const batch = parsedCompanies.value.slice(i, i + BATCH_SIZE)
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1
      const taskNameFull = `${taskName.value}_Batch${String(batchIndex).padStart(2, '0')}_${batch[0]}-${batch[batch.length - 1]}`
      
      const config: TaskConfig = {
        name: taskNameFull,
        sites: sites.value,
        keywords: keywords.value,
        keyword: keywords.value[0],
        cities: cities.value,
        city: cities.value[0],
        companies: batch,
        company: batch[0],
        maxPages: maxPages.value
      }
      
      try {
        const res = await crawlerStore.createTask(config)
        if (res?.success) {
          successCount++
          ElMessage.success(`✅ 批次 ${batchIndex}/${totalBatches.value} 创建成功`)
        } else {
          failCount++
          ElMessage.error(`❌ 批次 ${batchIndex} 创建失败`)
        }
      } catch (error: any) {
        failCount++
        ElMessage.error(`❌ 批次 ${batchIndex} 异常: ${error.message}`)
      }
      
      if (batchIndex % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  } else {
    // 🔧 无企业名单：创建单个任务，不限制企业
    const taskNameFull = `${taskName.value}_${cities.value.join('-')}`
    
    const config: TaskConfig = {
      name: taskNameFull,
      sites: sites.value,
      keywords: keywords.value,
      keyword: keywords.value[0],
      cities: cities.value,
      city: cities.value[0],
      companies: [],  // 不限制企业
      company: '',
      maxPages: maxPages.value
    }
    
    try {
      const res = await crawlerStore.createTask(config)
      if (res?.success) {
        successCount = 1
        ElMessage.success('✅ 任务创建成功')
      } else {
        failCount = 1
        ElMessage.error('❌ 任务创建失败')
      }
    } catch (error: any) {
      failCount = 1
      ElMessage.error(`❌ 任务异常: ${error.message}`)
    }
  }
  
  ElMessageBox.alert(
    `任务创建完成！\n\n成功: ${successCount} 个\n失败: ${failCount} 个`,
    '创建完成',
    {
      confirmButtonText: '查看任务列表',
      callback: () => {
        router.push('/crawler')
      }
    }
  )
}

function cancel() {
  router.back()
}
</script>

<template>
  <div class="batch-task-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>🚀 批量任务创建工具</span>
          <el-tag type="info">适合大规模企业筛选场景</el-tag>
        </div>
      </template>

      <el-alert
        title="使用指南"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <p>💡 本工具适用于需要从大量企业中筛选职位的场景（如3000家企业）</p>
        <p>📋 系统会自动将企业列表分成多个批次，每批50家企业，分别创建独立任务</p>
        <p>⏱️ 预计总耗时会根据并发数量自动计算，建议同时运行不超过5个任务</p>
      </el-alert>

      <el-form label-width="140px">
        <el-form-item label="任务名称前缀" required>
          <el-input
            v-model="taskName"
            placeholder="例如：Java开发招聘分析"
            clearable
          />
          <div class="form-tip">最终任务名将自动添加批次编号，如：Java开发招聘分析_Batch01_阿里-百度</div>
        </el-form-item>

        <!-- 🔧 新增：数据来源选择 -->
        <el-form-item label="数据来源" required>
          <el-checkbox-group v-model="sites">
            <el-checkbox value="zhilian">智联招聘</el-checkbox>
            <el-checkbox value="51job">前程无忧</el-checkbox>
          </el-checkbox-group>
          <div class="form-tip">提示：可以选择一个或两个数据源同时爬取</div>
        </el-form-item>

        <el-form-item label="职位关键词" required>
          <div class="input-with-tags">
            <el-input
              v-model="keywordInput"
              placeholder="可一次性输入多个关键词，用逗号/顿号/分号/空格分隔，如：'Java开发,前端工程师,产品经理'"
              clearable
              @keyup.enter="addKeyword"
            >
              <template #append>
                <el-button @click="addKeyword">添加</el-button>
              </template>
            </el-input>
            <div class="tags-container" v-if="keywords.length > 0">
              <el-tag
                v-for="(kw, index) in keywords"
                :key="index"
                closable
                @close="removeKeyword(index)"
                style="margin: 4px"
              >
                {{ kw }}
              </el-tag>
            </div>
          </div>
          <div class="form-tip">
            💡 提示：支持批量输入，可一次性输入10个关键词（如：'Java开发,前端工程师,产品经理'），最多支持{{ MAX_KEYWORDS }}个关键词
          </div>
        </el-form-item>

        <el-form-item label="工作地区" required>
          <el-select v-model="selectedProvince" placeholder="选择省份" style="width: 200px; margin-right: 10px" @change="handleProvinceChange">
            <el-option
              v-for="province in provinces"
              :key="province.value"
              :label="province.label"
              :value="province.value"
            />
          </el-select>
          
          <div class="city-selector" v-if="selectedProvince">
            <div class="city-label">选择城市（可多选）：</div>
            <div class="city-tags">
              <el-tag
                v-for="city in citiesMap[selectedProvince]"
                :key="city"
                :type="cities.includes(city) ? 'primary' : 'info'"
                @click="toggleCity(city)"
                style="margin: 4px; cursor: pointer"
              >
                {{ city }}
              </el-tag>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="每批次最大页数">
          <el-slider v-model="maxPages" :min="1" :max="20" show-input />
          <div class="form-tip">建议设置为5-10页，平衡数据量和爬取时间</div>
        </el-form-item>

        <el-form-item label="企业名单（可选）">
          <div class="form-tip" style="margin-bottom: 10px">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                💡 <strong>可选功能</strong>：如果不填写企业名单，将搜索所有企业的职位；如果填写，则只搜索指定企业的职位
              </template>
            </el-alert>
          </div>
          
          <div style="display: flex; gap: 10px; margin-bottom: 10px">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handleFileImport"
              accept=".txt,.csv"
            >
              <el-button :icon="Upload">📁 从文件导入</el-button>
            </el-upload>
            <el-button :icon="Download" @click="downloadTemplate">📥 下载模板</el-button>
            <el-button v-if="parsedCompanies.length > 0" @click="() => { companyText = ''; parsedCompanies = [] }">
              🗑️ 清空列表
            </el-button>
          </div>
            
          <el-input
            v-model="companyText"
            type="textarea"
            :rows="12"
            placeholder="可选：在此粘贴企业名单，每行一个企业名称，或使用逗号/分号分隔&#10;&#10;示例：&#10;阿里巴巴&#10;腾讯科技&#10;字节跳动&#10;百度在线&#10;&#10;💡 留空则搜索所有企业的职位"
            style="margin-top: 10px"
          />
          
          <div class="parse-result" v-if="parsedCompanies.length > 0">
            <el-alert
              :title="`✅ 已解析 ${parsedCompanies.length} 家企业，将分为 ${totalBatches} 批，预计耗时 ${estimatedTime} 小时`"
              type="success"
              :closable="false"
            />
            
            <div class="preview-section">
              <div class="preview-title">前10家企业预览：</div>
              <div class="preview-tags">
                <el-tag
                  v-for="(comp, index) in parsedCompanies.slice(0, 10)"
                  :key="index"
                  size="small"
                  type="success"
                  style="margin: 2px"
                >
                  {{ comp }}
                </el-tag>
                <el-tag v-if="parsedCompanies.length > 10" size="small" type="info">
                  +{{ parsedCompanies.length - 10 }} 更多
                </el-tag>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button 
            type="primary" 
            size="large" 
            @click="createBatchTasks"
          >
            🚀 {{ hasCompanyList ? `开始批量创建（${totalBatches} 个任务）` : '开始创建任务（不限企业）' }}
          </el-button>
          <el-button size="large" @click="cancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.batch-task-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.input-with-tags {
  width: 100%;
}

.tags-container {
  margin-top: 8px;
}

.city-selector {
  margin-top: 10px;
}

.city-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.city-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.company-input-section {
  width: 100%;
}

.input-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.parse-result {
  margin-top: 15px;
}

.preview-section {
  margin-top: 15px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
