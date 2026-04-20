
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCrawlerStore } from '@/stores/crawler'
import { type TaskConfig } from '@/api/task'

const router = useRouter()
const route = useRoute()
const crawlerStore = useCrawlerStore()

// 组件存活标记
let isComponentAlive = true

// 组件卸载时设置标记
onUnmounted(() => {
  console.log('[EditTask] 组件已卸载')
  isComponentAlive = false
})

// 省份和城市数据
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

const cities = ref<{ [key: string]: string[] }>({
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
})

const selectedProvince = ref('')
const selectedCities = ref<string[]>([])

// 多个关键词和企业名称
const keywordInput = ref('')
const companyInput = ref('')
const keywords = ref<string[]>([])
const companies = ref<string[]>([])

const taskForm = ref<TaskConfig>({
  sites: [],
  keyword: '',
  company: '',
  maxPages: 5,
  delay: [2, 5],
  concurrency: 2,
  province: '',
  city: ''
})

const loading = ref(false)
const saving = ref(false)

// 加载任务配置
onMounted(async () => {
  const taskId = route.params.id as string
  if (!taskId) {
    ElMessage.error('任务ID不存在')
    router.push('/crawler')
    return
  }

  loading.value = true
  try {
    // 从后端获取任务详情
    const response = await fetch(`http://localhost:3004/api/tasks/${taskId}`)
    if (!response.ok) {
      throw new Error(`获取任务详情失败: HTTP ${response.status} ${response.statusText}`)
    }
    
    const apiResponse = await response.json()
    
    console.log('[EditTask] API原始响应:', apiResponse)
    
    // 检查API响应格式
    if (!apiResponse.success) {
      throw new Error(apiResponse.error || apiResponse.message || '获取任务详情失败')
    }
    
    // 提取data字段中的任务数据
    const task = apiResponse.data
    
    console.log('[EditTask] 任务数据:', task)
    
    // 防御性检查: 确保task和config存在
    if (!task) {
      throw new Error('任务数据为空')
    }
    
    // 解析config字段
    let config: any = null
    try {
      if (typeof task.config === 'string') {
        config = JSON.parse(task.config)
      } else if (task.config && typeof task.config === 'object') {
        config = task.config
      } else {
        console.warn('[EditTask] config字段格式异常:', task.config)
        config = {}
      }
    } catch (parseError: any) {
      console.error('[EditTask] JSON解析失败:', parseError.message)
      console.error('[EditTask] 原始config值:', task.config)
      throw new Error(`配置数据解析失败: ${parseError.message}`)
    }
    
    console.log('[EditTask] 解析后的config:', config)
    
    // 填充表单 - 使用可选链和默认值
    taskForm.value = {
      sites: config?.sites || [],
      keyword: config?.keyword || '',
      company: config?.company || '',
      maxPages: config?.maxPages || 5,
      delay: Array.isArray(config?.delay) ? config.delay : [2, 5],
      concurrency: config?.concurrency || 2,
      province: config?.province || '',
      city: config?.city || ''
    }
    
    // 填充关键词列表
    if (config?.keywords && Array.isArray(config.keywords)) {
      keywords.value = config.keywords
    } else if (config?.keyword) {
      keywords.value = [config.keyword]
    }
    
    // 填充企业列表
    if (config?.companies && Array.isArray(config.companies)) {
      companies.value = config.companies
    } else if (config?.company) {
      companies.value = [config.company]
    }
    
    // 填充城市选择
    if (config?.cities && Array.isArray(config.cities)) {
      selectedCities.value = config.cities
      // 根据第一个城市推断省份
      if (selectedCities.value.length > 0) {
        const firstCity = selectedCities.value[0]
        for (const [prov, cityList] of Object.entries(cities.value)) {
          if (cityList.includes(firstCity)) {
            selectedProvince.value = prov
            break
          }
        }
      }
    }
  } catch (error: any) {
    if (!isComponentAlive) {
      console.warn('[EditTask] 组件已卸载，忽略错误处理')
      return
    }
    
    console.error('[EditTask] 加载任务失败:', error)
    ElMessage.error('加载任务配置失败: ' + error.message)
    
    if (isComponentAlive) {
      router.push('/crawler')
    }
  } finally {
    if (isComponentAlive) {
      loading.value = false
    }
  }
})

// 添加关键词
function addKeyword() {
  const kw = keywordInput.value.trim()
  if (!kw) return
  
  if (keywords.value.includes(kw)) {
    ElMessage.warning('该关键词已存在')
    return
  }
  
  keywords.value.push(kw)
  keywordInput.value = ''
}

// 移除关键词
function removeKeyword(index: number) {
  keywords.value.splice(index, 1)
}

// 添加企业
function addCompany() {
  const comp = companyInput.value.trim()
  if (!comp) return
  
  if (companies.value.includes(comp)) {
    ElMessage.warning('该企业名称已存在')
    return
  }
  
  companies.value.push(comp)
  companyInput.value = ''
}

// 移除企业
function removeCompany(index: number) {
  companies.value.splice(index, 1)
}

// 省份变化处理
function handleProvinceChange() {
  // 清空已选城市
  selectedCities.value = []
}

// 切换城市选择
function toggleCity(city: string) {
  const index = selectedCities.value.indexOf(city)
  if (index > -1) {
    selectedCities.value.splice(index, 1)
  } else {
    selectedCities.value.push(city)
  }
}

// 保存并重新启动
async function saveAndRestart() {
  // 验证必填项
  if (taskForm.value.sites.length === 0) {
    ElMessage.warning('请选择数据来源')
    return
  }
  
  if (keywords.value.length === 0) {
    ElMessage.warning('请至少添加一个职位关键词')
    return
  }
  
  if (selectedCities.value.length === 0) {
    ElMessage.warning('请至少选择一个城市')
    return
  }
  
  saving.value = true
  
  try {
    const taskId = route.params.id as string
    
    // 构建新的配置
    const newConfig: TaskConfig = {
      ...taskForm.value,
      keywords: keywords.value,
      keyword: keywords.value[0], // 保留第一个作为主关键词
      companies: companies.value,
      company: companies.value[0] || '', // 保留第一个作为主企业
      cities: selectedCities.value,
      city: selectedCities.value[0] || '' // 保留第一个作为主城市
    }
    
    // 删除旧任务
    await crawlerStore.deleteTask(taskId)
    
    // 检查组件是否仍然存活
    if (!isComponentAlive) {
      console.warn('[EditTask] 组件已卸载，取消后续操作')
      return
    }
    
    // 创建新任务
    await crawlerStore.createTask(newConfig)
    
    // 再次检查组件状态
    if (!isComponentAlive) {
      console.warn('[EditTask] 组件已卸载，取消跳转')
      return
    }
    
    ElMessage.success('配置已保存，任务已重新创建')
    await router.push('/crawler')
  } catch (error: any) {
    if (!isComponentAlive) {
      console.warn('[EditTask] 组件已卸载，忽略错误处理')
      return
    }
    
    console.error('[EditTask] 保存失败:', error)
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    if (isComponentAlive) {
      saving.value = false
    }
  }
}

// 取消
function cancel() {
  if (isComponentAlive) {
    router.push('/crawler')
  }
}
</script>

<template>
  <div class="edit-task-page" v-loading="loading">
    <el-card>
      <template #header>
        <span>配置爬虫任务</span>
      </template>

      <el-form :model="taskForm" label-width="120px">
        <el-form-item label="数据来源" required>
          <el-checkbox-group v-model="taskForm.sites">
            <el-checkbox value="zhilian">智联招聘</el-checkbox>
            <el-checkbox value="51job">前程无忧</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="职位关键词" required>
          <div class="input-with-tags">
            <el-input
              v-model="keywordInput"
              placeholder="输入关键词后按回车或点击添加"
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
          <div class="form-tip">提示：可以添加多个关键词，系统将依次爬取每个关键词的职位信息</div>
        </el-form-item>

        <el-form-item label="企业名称">
          <div class="input-with-tags">
            <el-input
              v-model="companyInput"
              placeholder="输入企业名称后按回车或点击添加（可选）"
              clearable
              @keyup.enter="addCompany"
            >
              <template #append>
                <el-button @click="addCompany">添加</el-button>
              </template>
            </el-input>
            <div class="tags-container" v-if="companies.length > 0">
              <el-tag
                v-for="(comp, index) in companies"
                :key="index"
                closable
                @close="removeCompany(index)"
                style="margin: 4px"
                type="success"
              >
                {{ comp }}
              </el-tag>
            </div>
          </div>
          <div class="form-tip">提示：可以添加多个企业名称，用于精确匹配特定企业的职位</div>
        </el-form-item>

        <el-form-item label="工作地区">
          <el-select v-model="selectedProvince" placeholder="选择省份" @change="handleProvinceChange" style="width: 200px">
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
                v-for="city in cities[selectedProvince]"
                :key="city"
                :type="selectedCities.includes(city) ? 'primary' : 'info'"
                @click="toggleCity(city)"
                style="margin: 4px; cursor: pointer"
              >
                {{ city }}
              </el-tag>
            </div>
            <div class="selected-cities" v-if="selectedCities.length > 0">
              <span class="label">已选城市：</span>
              <el-tag
                v-for="city in selectedCities"
                :key="city"
                closable
                @close="toggleCity(city)"
                style="margin: 4px"
              >
                {{ city }}
              </el-tag>
            </div>
          </div>
        </el-form-item>

        <el-collapse>
          <el-collapse-item title="高级配置" name="advanced">
            <el-form-item label="最大页数">
              <el-input-number v-model="taskForm.maxPages" :min="1" :max="50" />
              <span class="form-tip" style="margin-left: 10px">每个关键词/城市组合的最大爬取页数</span>
            </el-form-item>

            <el-form-item label="请求间隔(秒)">
              <el-slider v-model="taskForm.delay" range :min="1" :max="10" :step="0.5" show-input />
            </el-form-item>

            <el-form-item label="并发数">
              <el-input-number v-model="taskForm.concurrency" :min="1" :max="5" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>

        <el-alert
          title="提示"
          type="info"
          description="修改配置后将删除当前任务并创建新任务，原任务的爬取数据将丢失。系统将按照 关键词 × 城市 的组合进行爬取。"
          show-icon
          :closable="false"
          style="margin-bottom: 20px"
        />

        <el-form-item>
          <el-button type="primary" @click="saveAndRestart" :loading="saving">保存并重新启动</el-button>
          <el-button @click="cancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.edit-task-page {
  max-width: 900px;
  margin: 0 auto;
}

.el-form-item {
  margin-bottom: 20px;
}

.input-with-tags {
  width: 100%;
}

.tags-container {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  display: block;
}

.city-selector {
  margin-top: 10px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.city-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.city-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.selected-cities {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
}

.selected-cities .label {
  font-size: 13px;
  color: #606266;
  margin-right: 8px;
}
</style>