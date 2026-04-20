<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fileApi } from '@/api/file'
import * as echarts from 'echarts'

const route = useRoute()
const loading = ref(false)
const analysisResult = ref<any>(null)
const fileInfo = ref<any>(null)
const salaryChart = ref<any>(null)
const cityChart = ref<any>(null)
const positionChart = ref<any>(null)

onMounted(async () => {
  // 如果URL中有fileId参数，直接加载分析
  const fileId = route.query.fileId as string
  if (fileId) {
    await loadAndAnalyze(fileId)
  }
})

// 🔧 新增：加载并分析文件
async function loadAndAnalyze(fileId: string) {
  loading.value = true
  try {
    // 1. 获取文件信息
    const fileRes = await fileApi.getFile(fileId)
    if (fileRes.data) {
      fileInfo.value = fileRes.data
    }
    
    // 2. 分析CSV数据
    const analyzeRes = await fileApi.analyzeFile(fileId)
    if (analyzeRes.success && analyzeRes.data) {
      analysisResult.value = analyzeRes.data
      ElMessage.success('数据分析完成')
      initCharts()
    } else {
      ElMessage.warning('暂无数据可分析')
    }
  } catch (error: any) {
    console.error('[Analysis] Error:', error)
    ElMessage.error(error.response?.data?.error || '分析失败')
  } finally {
    loading.value = false
  }
}

// 计算薪资分布数据（假设CSV中有salary字段）
const salaryDistribution = computed(() => {
  if (!analysisResult.value?.fieldStats?.salary?.topValues) return []
  
  return analysisResult.value.fieldStats.salary.topValues.map((item: any) => ({
    name: item.value,
    value: item.count
  }))
})

// 计算城市分布数据（假设CSV中有city字段）
const cityDistribution = computed(() => {
  if (!analysisResult.value?.fieldStats?.city?.topValues) return []
  
  return analysisResult.value.fieldStats.city.topValues.map((item: any) => ({
    city: item.value,
    count: item.count
  }))
})

// 计算职位分布数据（假设CSV中有position字段）
const positionDistribution = computed(() => {
  if (!analysisResult.value?.fieldStats?.position?.topValues) return []
  
  return analysisResult.value.fieldStats.position.topValues.map((item: any) => ({
    position: item.value,
    count: item.count
  }))
})

// 初始化图表
function initCharts() {
  if (!analysisResult.value) return

  // 初始化薪资分布饼图
  if (salaryDistribution.value.length > 0) {
    if (salaryChart.value) salaryChart.value.dispose()
    salaryChart.value = echarts.init(document.getElementById('salary-chart'))
    salaryChart.value.setOption({
      title: { text: '薪资分布', left: 'center' },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: '40' },
      series: [{
        name: '薪资分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        data: salaryDistribution.value,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }]
    })
  }

  // 初始化城市分布柱状图
  if (cityDistribution.value.length > 0) {
    if (cityChart.value) cityChart.value.dispose()
    cityChart.value = echarts.init(document.getElementById('city-chart'))
    cityChart.value.setOption({
      title: { text: '热门城市分布', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { 
        type: 'category', 
        data: cityDistribution.value.map(item => item.city),
        axisLabel: { rotate: 45 }
      },
      yAxis: { type: 'value' },
      series: [{
        name: '职位数量',
        type: 'bar',
        data: cityDistribution.value.map(item => item.count),
        itemStyle: { color: '#409EFF' }
      }]
    })
  }

  // 初始化职位分布横向柱状图
  if (positionDistribution.value.length > 0) {
    if (positionChart.value) positionChart.value.dispose()
    positionChart.value = echarts.init(document.getElementById('position-chart'))
    positionChart.value.setOption({
      title: { text: '热门职位TOP10', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { 
        type: 'category', 
        data: positionDistribution.value.slice(0, 10).map(item => item.position).reverse(),
        axisLabel: { interval: 0 }
      },
      series: [{
        name: '职位数量',
        type: 'bar',
        data: positionDistribution.value.slice(0, 10).map(item => item.count).reverse(),
        itemStyle: { color: '#67C23A' }
      }]
    })
  }
}

// 窗口大小改变时重新渲染图表
window.addEventListener('resize', () => {
  salaryChart.value?.resize()
  cityChart.value?.resize()
  positionChart.value?.resize()
})
</script>

<template>
  <div class="analysis-page">
    <!-- 文件信息卡片 -->
    <el-card v-if="fileInfo" class="mb-4">
      <template #header>
        <div class="card-header">
          <span>📊 数据分析报告</span>
          <el-tag type="info">{{ fileInfo.filename }}</el-tag>
        </div>
      </template>
      
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
      
      <!-- 数据概览 -->
      <div v-if="!loading && analysisResult" class="data-overview">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="总记录数">
            <el-statistic :value="analysisResult.totalRecords" />
          </el-descriptions-item>
          <el-descriptions-item label="字段数量">
            <el-statistic :value="analysisResult.headers.length" />
          </el-descriptions-item>
          <el-descriptions-item label="分析时间">
            {{ new Date().toLocaleString('zh-CN') }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- 字段统计详情 -->
    <el-card v-if="!loading && analysisResult?.fieldStats" class="mb-4">
      <template #header>
        <span>📋 字段统计详情</span>
      </template>
      
      <el-collapse accordion>
        <el-collapse-item 
          v-for="(stats, fieldName) in analysisResult.fieldStats" 
          :key="fieldName"
          :title="`${fieldName} (唯一值: ${stats.uniqueCount}, 非空: ${stats.totalCount})`"
        >
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="总记录数">{{ stats.totalCount }}</el-descriptions-item>
            <el-descriptions-item label="空值数量">{{ stats.emptyCount }}</el-descriptions-item>
            <el-descriptions-item label="唯一值数量">{{ stats.uniqueCount }}</el-descriptions-item>
            <el-descriptions-item v-if="stats.avg" label="平均值">{{ stats.avg.toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item v-if="stats.min !== undefined" label="最小值">{{ stats.min }}</el-descriptions-item>
            <el-descriptions-item v-if="stats.max !== undefined" label="最大值">{{ stats.max }}</el-descriptions-item>
          </el-descriptions>
          
          <!-- Top Values -->
          <div v-if="stats.topValues && stats.topValues.length > 0" class="top-values">
            <h4>Top 分布</h4>
            <el-table :data="stats.topValues.slice(0, 10)" size="small" max-height="300">
              <el-table-column prop="value" label="值" min-width="150" show-overflow-tooltip />
              <el-table-column prop="count" label="数量" width="100" />
              <el-table-column label="占比" width="120">
                <template #default="{ row }">
                  {{ ((row.count / analysisResult.totalRecords) * 100).toFixed(1) }}%
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 可视化图表 -->
    <div v-if="!loading && analysisResult" class="analysis-charts">
      <el-row :gutter="16">
        <el-col v-if="salaryDistribution.length > 0" :span="12">
          <el-card>
            <template #header>
              <span>💰 薪资分布</span>
            </template>
            <div id="salary-chart" style="width: 100%; height: 400px;"></div>
          </el-card>
        </el-col>
        
        <el-col v-if="cityDistribution.length > 0" :span="12">
          <el-card>
            <template #header>
              <span>🌆 城市分布</span>
            </template>
            <div id="city-chart" style="width: 100%; height: 400px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col v-if="positionDistribution.length > 0" :span="24">
          <el-card>
            <template #header>
              <span>💼 热门职位TOP10</span>
            </template>
            <div id="position-chart" style="width: 100%; height: 400px;"></div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <el-empty v-if="!loading && !analysisResult" description="请从任务列表点击'分析'按钮查看数据分析" />
  </div>
</template>

<style scoped>
.analysis-page {
  padding: 0;
}

.mb-4 {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-overview {
  margin-top: 16px;
}

.top-values {
  margin-top: 16px;
}

.top-values h4 {
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
}

.analysis-charts {
  margin-top: 16px;
}

.el-card {
  margin-bottom: 16px;
}

.loading-container {
  padding: 20px;
}
</style>
