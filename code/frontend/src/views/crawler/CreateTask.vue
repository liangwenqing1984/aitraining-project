<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCrawlerStore } from '@/stores/crawler'
import { type TaskConfig } from '@/api/task'

const router = useRouter()
const crawlerStore = useCrawlerStore()

// 组件存活标记
let isComponentAlive = true

// 组件卸载时设置标记
onUnmounted(() => {
  console.log('[CreateTask] 组件已卸载')
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

// 省份改变时更新城市选项
const handleProvinceChange = (value: string) => {
  selectedProvince.value = value
  selectedCities.value = []
}

// 添加关键词
function addKeyword() {
  const value = keywordInput.value.trim()
  if (value && !keywords.value.includes(value)) {
    keywords.value.push(value)
    keywordInput.value = ''
  }
}

// 删除关键词
function removeKeyword(index: number) {
  keywords.value.splice(index, 1)
}

// 添加企业名称
function addCompany() {
  const value = companyInput.value.trim()
  if (value && !companies.value.includes(value)) {
    companies.value.push(value)
    companyInput.value = ''
  }
}

// 删除企业名称
function removeCompany(index: number) {
  companies.value.splice(index, 1)
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

async function startTask() {
  // 验证数据来源
  if (!taskForm.value.sites.length) {
    ElMessage.warning('请选择至少一个数据来源')
    return
  }

  console.log('[CreateTask] ========== 开始创建任务 ==========')
  console.log('[CreateTask] 当前关键词列表:', keywords.value)
  console.log('[CreateTask] 关键词数量:', keywords.value.length)
  console.log('[CreateTask] 已选城市:', selectedCities.value)
  console.log('[CreateTask] 企业名称:', companies.value)
  
  // 验证关键词 - 必须通过添加按钮添加到列表
  if (keywords.value.length === 0) {
    ElMessage.warning('请至少输入一个职位关键词，并点击"添加"按钮')
    console.warn('[CreateTask] 验证失败: 关键词列表为空')
    return
  }

  loading.value = true
  try {
    // 构建配置，支持多个关键词、企业和城市
    const config: TaskConfig = {
      sites: taskForm.value.sites,
      keywords: keywords.value,
      keyword: keywords.value[0], // 保持向后兼容
      maxPages: taskForm.value.maxPages,
      delay: taskForm.value.delay,
      concurrency: taskForm.value.concurrency,
      province: taskForm.value.province || selectedProvince.value,
    }
    
    // 只添加非空可选字段
    if (companies.value.length > 0) {
      config.companies = companies.value
      config.company = companies.value[0]
    }
    
    if (selectedCities.value.length > 0) {
      config.cities = selectedCities.value
      config.city = selectedCities.value[0]
    }
    
    console.log('[CreateTask] 发送任务配置:', JSON.stringify(config, null, 2))
    
    // 调用store创建任务
    const res = await crawlerStore.createTask(config)
    
    console.log('[CreateTask] 收到响应:', res)
    
    // 检查组件是否仍然存活
    if (!isComponentAlive) {
      console.warn('[CreateTask] 组件已卸载，取消后续操作')
      return
    }
    
    // 检查响应
    if (res && res.success) {
      if (res.data && res.data.taskId) {
        ElMessage.success('任务创建成功')
        const taskId = res.data.taskId
        console.log('[CreateTask] 任务ID:', taskId)
        console.log('[CreateTask] 准备跳转到监控页面:', `/crawler/monitor/${taskId}`)
        
        // 再次检查组件状态后跳转
        if (isComponentAlive) {
          // 使用 nextTick 确保DOM更新完成后再跳转
          await new Promise(resolve => setTimeout(resolve, 300))
          
          if (isComponentAlive) {
            console.log('[CreateTask] 执行路由跳转')
            await router.push(`/crawler/monitor/${taskId}`)
          } else {
            console.warn('[CreateTask] 跳转前组件已卸载，取消跳转')
          }
        }
      } else {
        console.error('[CreateTask] 响应中缺少taskId:', res)
        ElMessage.error('任务创建失败：未返回任务ID')
      }
    } else {
      console.error('[CreateTask] 创建失败:', res)
      ElMessage.error(res?.error || res?.message || '任务创建失败')
    }
  } catch (error: any) {
    // 如果组件已卸载，不显示错误消息
    if (!isComponentAlive) {
      console.warn('[CreateTask] 组件已卸载，忽略错误处理')
      return
    }
    
    console.error('[CreateTask] ❌ 异常:', error)
    console.error('[CreateTask] 错误消息:', error.message)
    console.error('[CreateTask] 错误堆栈:', error.stack)
    
    // 提供更友好的错误提示
    let errorMsg = '任务创建失败'
    if (error.response) {
      // 服务器返回了错误响应
      errorMsg = error.response.data?.error || error.response.data?.message || `服务器错误 (${error.response.status})`
    } else if (error.request) {
      // 请求已发出但没有收到响应
      errorMsg = '无法连接到服务器，请检查后端服务是否运行'
    } else {
      errorMsg = error.message || errorMsg
    }
    
    ElMessage.error(errorMsg)
  } finally {
    // 只有在组件仍然存活时才更新loading状态
    if (isComponentAlive) {
      loading.value = false
    }
    console.log('[CreateTask] ========== 结束 ==========')
  }
}

function resetForm() {
  taskForm.value = {
    sites: [],
    keyword: '',
    company: '',
    maxPages: 5,
    delay: [2, 5],
    concurrency: 2,
    province: '',
    city: ''
  }
  selectedProvince.value = ''
  selectedCities.value = []
  keywords.value = []
  companies.value = []
  keywordInput.value = ''
  companyInput.value = ''
}

function cancel() {
  router.back()
}
</script>

<template>
  <div class="create-task-page">
    <el-card>
      <template #header>
        <span>创建爬虫任务</span>
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
            </el-form-item>

            <el-form-item label="请求间隔(秒)">
              <el-slider v-model="taskForm.delay" range :min="1" :max="10" :step="0.5" show-input />
            </el-form-item>

            <el-form-item label="并发数">
              <el-input-number v-model="taskForm.concurrency" :min="1" :max="5" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>

        <el-form-item>
          <el-button type="primary" @click="startTask" :loading="loading">创建</el-button>
          <el-button @click="resetForm">重置</el-button>
          <el-button @click="cancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.create-task-page {
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
