<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fileApi } from '@/api/file'
import * as echarts from 'echarts'

const route = useRoute()
const loading = ref(false)
const analysisResult = ref<any>(null)
const fileInfo = ref<any>(null)

// 图表实例
const charts: Record<string, any> = {}

onMounted(async () => {
  const fileId = route.query.fileId as string
  if (fileId) {
    await loadAndAnalyze(fileId)
  }
})

// 加载并分析文件
async function loadAndAnalyze(fileId: string) {
  loading.value = true
  try {
    // 1. 获取文件信息
    const fileRes: any = await fileApi.getFile(fileId)
    if (fileRes.data) {
      fileInfo.value = fileRes.data
      console.log('[Analysis] 文件信息:', {
        id: fileRes.data.id,
        filename: fileRes.data.filename,
        recordCount: fileRes.data.record_count,
        fileSize: fileRes.data.file_size
      })
    }
    
    // 2. 分析CSV数据
    const analyzeRes: any = await fileApi.analyzeFile(fileId)
    if (analyzeRes.success && analyzeRes.data) {
      analysisResult.value = analyzeRes.data
      
      // 🔧 详细诊断日志
      console.log('[Analysis] ========== 分析结果诊断 ==========')
      console.log('[Analysis] 后端返回的总记录数:', analyzeRes.data.totalRecords)
      console.log('[Analysis] 后端返回的字段数量:', analyzeRes.data.headers?.length)
      console.log('[Analysis] 字段列表:', analyzeRes.data.headers)
      console.log('[Analysis] 字段统计信息数量:', Object.keys(analyzeRes.data.fieldStats || {}).length)
      console.log('[Analysis] ======================================')
      
      ElMessage.success('数据分析完成')
      
      // 延迟初始化图表，确保DOM已渲染
      setTimeout(() => {
        initAllCharts()
      }, 100)
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

// 计算属性：薪资分布数据
const salaryDistributionData = computed(() => {
  if (!analysisResult.value?.salaryAnalysis?.distribution) return []
  return analysisResult.value.salaryAnalysis.distribution.map((item: any) => ({
    name: item.label,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：城市分布数据
const cityDistributionData = computed(() => {
  if (!analysisResult.value?.headers) return []
  
  // 🔧 关键修复：优先精确匹配"工作城市"
  let cityField = analysisResult.value.headers.find((h: string) => h === '工作城市')
  
  // 降级模糊匹配
  if (!cityField) {
    cityField = analysisResult.value.headers.find((h: string) => h.includes('城市'))
  }
  
  console.log('[Analysis] 城市字段匹配结果:', {
    cityField,
    allHeaders: analysisResult.value.headers,
    hasTopValues: !!analysisResult.value?.fieldStats?.[cityField]?.topValues,
    topValuesCount: analysisResult.value?.fieldStats?.[cityField]?.topValues?.length || 0
  })
  
  if (!cityField || !analysisResult.value?.fieldStats?.[cityField]?.topValues) {
    console.warn('[Analysis] 城市分布数据为空', { cityField })
    return []
  }
  
  return analysisResult.value.fieldStats[cityField].topValues.slice(0, 10).map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：职位分布数据（优先使用职位名称，而非职位ID）
const positionDistributionData = computed(() => {
  if (!analysisResult.value?.headers) return []
  
  // 🔧 关键修复：优先精确匹配"职位名称"，避免匹配到"职位ID"
  let jobField = analysisResult.value.headers.find((h: string) => h === '职位名称')
  
  // 如果没有精确匹配，再尝试模糊匹配（排除ID相关字段）
  if (!jobField) {
    jobField = analysisResult.value.headers.find((h: string) => 
      h.includes('职位') && !h.includes('ID') && !h.includes('id')
    )
  }
  
  console.log('[Analysis] 职位字段匹配结果:', {
    jobField,
    allHeaders: analysisResult.value.headers,
    hasTopValues: !!analysisResult.value?.fieldStats?.[jobField]?.topValues,
    topValuesCount: analysisResult.value?.fieldStats?.[jobField]?.topValues?.length || 0
  })
  
  if (!jobField || !analysisResult.value?.fieldStats?.[jobField]?.topValues) {
    console.warn('[Analysis] 职位分布数据为空', { jobField, fieldStats: analysisResult.value?.fieldStats?.[jobField] })
    return []
  }
  
  return analysisResult.value.fieldStats[jobField].topValues.slice(0, 10).map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：经验分布数据
const experienceDistributionData = computed(() => {
  if (!analysisResult.value?.headers) return []
  
  // 🔧 优先精确匹配
  let expField = analysisResult.value.headers.find((h: string) => h === '工作经验')
  
  // 降级模糊匹配
  if (!expField) {
    expField = analysisResult.value.headers.find((h: string) => h.includes('经验'))
  }
  
  console.log('[Analysis] 经验字段匹配结果:', {
    expField,
    hasTopValues: !!analysisResult.value?.fieldStats?.[expField]?.topValues,
    topValuesCount: analysisResult.value?.fieldStats?.[expField]?.topValues?.length || 0
  })
  
  if (!expField || !analysisResult.value?.fieldStats?.[expField]?.topValues) {
    console.warn('[Analysis] 经验分布数据为空', { expField })
    return []
  }
  
  return analysisResult.value.fieldStats[expField].topValues.map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：学历分布数据
const educationDistributionData = computed(() => {
  if (!analysisResult.value?.headers) return []
  
  // 🔧 优先精确匹配
  let eduField = analysisResult.value.headers.find((h: string) => h === '学历')
  
  // 降级模糊匹配
  if (!eduField) {
    eduField = analysisResult.value.headers.find((h: string) => h.includes('学历'))
  }
  
  console.log('[Analysis] 学历字段匹配结果:', {
    eduField,
    hasTopValues: !!analysisResult.value?.fieldStats?.[eduField]?.topValues,
    topValuesCount: analysisResult.value?.fieldStats?.[eduField]?.topValues?.length || 0
  })
  
  if (!eduField || !analysisResult.value?.fieldStats?.[eduField]?.topValues) {
    console.warn('[Analysis] 学历分布数据为空', { eduField })
    return []
  }
  
  return analysisResult.value.fieldStats[eduField].topValues.map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：企业性质分布
const companyNatureData = computed(() => {
  if (!analysisResult.value?.companyNatureAnalysis) {
    console.log('[Analysis] 企业性质分析数据不存在')
    return []
  }
  
  console.log('[Analysis] 企业性质数据:', {
    count: analysisResult.value.companyNatureAnalysis.length,
    data: analysisResult.value.companyNatureAnalysis
  })
  
  return analysisResult.value.companyNatureAnalysis.map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：公司规模分布
const companyScaleData = computed(() => {
  if (!analysisResult.value?.companyScaleAnalysis) {
    console.log('[Analysis] 公司规模分析数据不存在')
    return []
  }
  
  console.log('[Analysis] 公司规模数据:', {
    count: analysisResult.value.companyScaleAnalysis.length,
    data: analysisResult.value.companyScaleAnalysis
  })
  
  return analysisResult.value.companyScaleAnalysis.map((item: any) => ({
    name: item.value,
    value: item.count,
    percentage: item.percentage
  }))
})

// 计算属性：所有有数据的图表列表（用于动态布局）
const availableCharts = computed(() => {
  const chartsList: Array<{ id: string; title: string; hasData: boolean }> = [
    { id: 'salary', title: '薪资分布', hasData: salaryDistributionData.value.length > 0 },
    { id: 'city', title: '城市分布', hasData: cityDistributionData.value.length > 0 },
    { id: 'position', title: '职位分布', hasData: positionDistributionData.value.length > 0 },
    { id: 'experience', title: '经验分布', hasData: experienceDistributionData.value.length > 0 },
    { id: 'education', title: '学历分布', hasData: educationDistributionData.value.length > 0 },
    { id: 'companyNature', title: '企业性质', hasData: companyNatureData.value.length > 0 },
    { id: 'companyScale', title: '公司规模', hasData: companyScaleData.value.length > 0 }
  ]
  
  // 🔧 调试日志：输出所有图表的数据状态和CSV表头
  console.log('[Analysis] ========== 数据分析诊断 ==========')
  console.log('[Analysis] CSV文件表头:', analysisResult.value?.headers)
  console.log('[Analysis] 总记录数:', analysisResult.value?.totalRecords)
  console.log('[Analysis] 图表数据状态:', chartsList.map(c => ({
    id: c.id,
    title: c.title,
    hasData: c.hasData
  })))
  console.log('[Analysis] ======================================')
  
  return chartsList.filter(chart => chart.hasData)
})

// 初始化所有图表
function initAllCharts() {
  if (!analysisResult.value) return
  
  // 销毁旧图表
  Object.values(charts).forEach(chart => chart?.dispose())
  
  // 初始化各个图表
  if (salaryDistributionData.value.length > 0) {
    initSalaryChart()
  }
  if (cityDistributionData.value.length > 0) {
    initCityChart()
  }
  if (positionDistributionData.value.length > 0) {
    initPositionChart()
  }
  if (experienceDistributionData.value.length > 0) {
    initExperienceChart()
  }
  if (educationDistributionData.value.length > 0) {
    initEducationChart()
  }
  if (companyNatureData.value.length > 0) {
    initCompanyNatureChart()
  }
  if (companyScaleData.value.length > 0) {
    initCompanyScaleChart()
  }
}

// 初始化薪资分布图（面积图）
function initSalaryChart() {
  const dom = document.getElementById('salary-chart')
  if (!dom) return
  
  charts.salary = echarts.init(dom)
  const option = {
    title: {
      text: '💰 薪资区间分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>${data.value}个岗位 (${data.data.percentage}%)`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: salaryDistributionData.value.map((item: any) => item.name),
      axisLine: { lineStyle: { color: '#999' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#999' } },
      splitLine: { lineStyle: { color: '#eee' } }
    },
    series: [{
      name: '岗位数量',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: salaryDistributionData.value.map((item: any) => ({
        value: item.value,
        percentage: item.percentage
      })),
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(145, 204, 117, 0.8)' },
          { offset: 1, color: 'rgba(145, 204, 117, 0.1)' }
        ])
      },
      lineStyle: {
        width: 3,
        color: '#91cc75'
      },
      itemStyle: {
        color: '#91cc75',
        borderWidth: 2,
        borderColor: '#fff'
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        }
      }
    }]
  }
  charts.salary.setOption(option)
}

// 初始化城市分布图
function initCityChart() {
  const dom = document.getElementById('city-chart')
  if (!dom) return
  
  charts.city = echarts.init(dom)
  const option = {
    title: {
      text: '🌆 热门城市TOP10',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>${data.value}个岗位 (${data.data.percentage}%)`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}' }
    },
    yAxis: {
      type: 'category',
      data: cityDistributionData.value.map((item: any) => item.name).reverse(),
      axisTick: { alignWithLabel: true }
    },
    series: [{
      type: 'bar',
      data: cityDistributionData.value.map((item: any) => ({
        value: item.value,
        percentage: item.percentage
      })).reverse(),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#83bff6' },
          { offset: 0.5, color: '#188df0' },
          { offset: 1, color: '#188df0' }
        ]),
        borderRadius: [0, 5, 5, 0]
      },
      emphasis: {
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#2378f7' },
            { offset: 0.7, color: '#2378f7' },
            { offset: 1, color: '#83bff6' }
          ])
        }
      },
      animationDelay: (idx: number) => idx * 100
    }]
  }
  charts.city.setOption(option)
}

// 初始化职位分布图（词云风格柱状图）
function initPositionChart() {
  const dom = document.getElementById('position-chart')
  if (!dom) return
  
  charts.position = echarts.init(dom)
  const data = positionDistributionData.value
  const maxVal = Math.max(...data.map((item: any) => item.value))
  
  const option = {
    title: {
      text: '💼 热门职位TOP10',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const d = params[0]
        return `${d.name}<br/>${d.value}个岗位 (${d.data.percentage}%)`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map((item: any) => item.name),
      axisLabel: { 
        rotate: 45,
        interval: 0,
        formatter: (value: string) => {
          return value.length > 6 ? value.substring(0, 6) + '...' : value
        }
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      type: 'bar',
      data: data.map((item: any, index: number) => {
        const colors = [
          '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
          '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff9f7f'
        ]
        return {
          value: item.value,
          percentage: item.percentage,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colors[index % colors.length] },
              { offset: 1, color: colors[index % colors.length] + '80' }
            ]),
            borderRadius: [5, 5, 0, 0]
          }
        }
      }),
      barWidth: '60%',
      animationDelay: (idx: number) => idx * 80
    }]
  }
  charts.position.setOption(option)
}

// 初始化经验分布图（雷达图）
function initExperienceChart() {
  const dom = document.getElementById('experience-chart')
  if (!dom) return
  
  charts.experience = echarts.init(dom)
  const data = experienceDistributionData.value
  
  const option = {
    title: {
      text: '📊 经验要求分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item'
    },
    legend: {
      data: ['岗位数量'],
      bottom: 10
    },
    radar: {
      indicator: data.map((item: any) => ({
        name: item.name.length > 8 ? item.name.substring(0, 8) + '...' : item.name,
        max: Math.max(...data.map((d: any) => d.value)) * 1.2
      })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#666'
      },
      splitLine: {
        lineStyle: {
          color: ['#ddd', '#eee', '#f5f5f5', '#fafafa']
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(84, 112, 198, 0.05)', 'rgba(84, 112, 198, 0.1)']
        }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: data.map((item: any) => item.value),
        name: '岗位数量',
        areaStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
            { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
            { offset: 1, color: 'rgba(84, 112, 198, 0.8)' }
          ])
        },
        lineStyle: {
          width: 2,
          color: '#5470c6'
        },
        itemStyle: {
          color: '#5470c6'
        }
      }]
    }]
  }
  charts.experience.setOption(option)
}

// 初始化学历分布图（漏斗图）
function initEducationChart() {
  const dom = document.getElementById('education-chart')
  if (!dom) return
  
  charts.education = echarts.init(dom)
  const data = educationDistributionData.value
  
  const option = {
    title: {
      text: '🎓 学历要求分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个岗位 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: '学历要求',
        type: 'funnel',
        left: '20%',
        top: 60,
        bottom: 60,
        width: '60%',
        min: 0,
        max: Math.max(...data.map((item: any) => item.value)),
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}\n{c} ({d}%)'
        },
        labelLine: {
          length: 10,
          lineStyle: {
            width: 1,
            type: 'solid'
          }
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          label: {
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: data.map((item: any, index: number) => {
          const colors = ['#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
          return {
            value: item.value,
            name: item.name,
            percentage: item.percentage,
            itemStyle: {
              color: colors[index % colors.length]
            }
          }
        })
      }
    ]
  }
  charts.education.setOption(option)
}

// 初始化企业性质图（环形图）
function initCompanyNatureChart() {
  const dom = document.getElementById('company-nature-chart')
  if (!dom) return
  
  charts.companyNature = echarts.init(dom)
  const option = {
    title: {
      text: '🏢 企业性质分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}家企业 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['60%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      data: companyNatureData.value,
      color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']
    }]
  }
  charts.companyNature.setOption(option)
}

// 初始化公司规模图（仪表盘）
function initCompanyScaleChart() {
  const dom = document.getElementById('company-scale-chart')
  if (!dom) return
  
  charts.companyScale = echarts.init(dom)
  const data = companyScaleData.value
  const total = data.reduce((sum: number, item: any) => sum + item.value, 0)
  
  const option = {
    title: {
      text: '📈 公司规模分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      formatter: '{b}: {c}家企业 ({d}%)'
    },
    series: data.map((item: any, index: number) => {
      const colors = ['#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272']
      const percentage = ((item.value / total) * 100).toFixed(1)
      
      return {
        type: 'gauge',
        center: [`${20 + index * 20}%`, '55%'],
        radius: '70%',
        startAngle: 90,
        endAngle: -270,
        pointer: {
          show: false
        },
        progress: {
          show: true,
          overlap: false,
          roundCap: true,
          clip: false,
          itemStyle: {
            color: colors[index % colors.length]
          }
        },
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#eee']]
          }
        },
        splitLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        },
        data: [{
          value: parseFloat(percentage),
          name: item.name.length > 6 ? item.name.substring(0, 6) + '...' : item.name,
          title: {
            offsetCenter: ['0%', '30%'],
            fontSize: 12
          },
          detail: {
            valueAnimation: true,
            offsetCenter: ['0%', '-10%'],
            fontSize: 16,
            fontWeight: 'bold',
            formatter: '{value}%'
          }
        }],
        detail: {
          width: 30,
          height: 14,
          fontSize: 14,
          color: 'auto',
          borderColor: 'auto',
          borderRadius: 20,
          borderWidth: 1,
          formatter: '{value}%'
        }
      }
    })
  }
  charts.companyScale.setOption(option)
}

// 窗口大小改变时重新渲染图表
window.addEventListener('resize', () => {
  Object.values(charts).forEach(chart => chart?.resize())
})
</script>

<template>
  <div class="analysis-page">
    <!-- 文件信息卡片 -->
    <el-card v-if="fileInfo" class="mb-4 info-card">
      <template #header>
        <div class="card-header">
          <span class="title">📊 智能数据分析报告</span>
          <el-tag type="primary" effect="dark" size="large">{{ fileInfo.filename }}</el-tag>
        </div>
      </template>
      
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
      
      <!-- 数据概览 -->
      <div v-if="!loading && analysisResult" class="overview-section">
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-card stat-primary">
              <div class="stat-icon">📋</div>
              <div class="stat-content">
                <div class="stat-value">{{ analysisResult.totalRecords }}</div>
                <div class="stat-label">总记录数</div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card stat-success">
              <div class="stat-icon">📑</div>
              <div class="stat-content">
                <div class="stat-value">{{ analysisResult.headers.length }}</div>
                <div class="stat-label">字段数量</div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card stat-warning">
              <div class="stat-icon">⭐</div>
              <div class="stat-content">
                <div class="stat-value">{{ analysisResult.overallScore }}</div>
                <div class="stat-label">数据质量评分</div>
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card stat-info">
              <div class="stat-icon">🕒</div>
              <div class="stat-content">
                <div class="stat-value" style="font-size: 14px;">{{ new Date().toLocaleString('zh-CN') }}</div>
                <div class="stat-label">分析时间</div>
              </div>
            </div>
          </el-col>
        </el-row>
        
        <!-- 智能洞察 -->
        <div v-if="analysisResult.insights && analysisResult.insights.length > 0" class="insights-section">
          <h3 class="section-title">💡 智能洞察</h3>
          <el-row :gutter="16">
            <el-col v-for="(insight, index) in analysisResult.insights" :key="index" :span="12">
              <div class="insight-card" :class="`insight-${insight.level}`">
                <div class="insight-icon">{{ insight.icon }}</div>
                <div class="insight-content">
                  <div class="insight-title">{{ insight.title }}</div>
                  <div class="insight-text">{{ insight.content }}</div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
        
        <!-- 🔧 数据诊断面板（仅在有图表为空时显示） -->
        <div v-if="availableCharts.length < 7" class="diagnosis-section">
          <h3 class="section-title diagnosis-title">🔍 数据诊断</h3>
          <el-alert
            title="部分图表无数据显示原因"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              <div class="diagnosis-content">
                <p><strong>当前显示的图表：</strong>{{ availableCharts.length }} / 7</p>
                <p><strong>未显示的图表及原因：</strong></p>
                <ul class="diagnosis-list">
                  <li v-if="!salaryDistributionData.length">
                    💰 <strong>薪资分布</strong>：CSV中缺少"薪资范围"字段或数据无法解析
                  </li>
                  <li v-if="!cityDistributionData.length">
                    🌆 <strong>城市分布</strong>：CSV中缺少"工作城市"字段
                  </li>
                  <li v-if="!positionDistributionData.length">
                    💼 <strong>职位分布</strong>：CSV中缺少"职位名称"字段
                  </li>
                  <li v-if="!experienceDistributionData.length">
                    📊 <strong>经验分布</strong>：CSV中缺少"工作经验"字段
                  </li>
                  <li v-if="!educationDistributionData.length">
                    🎓 <strong>学历分布</strong>：CSV中缺少"学历"字段
                  </li>
                  <li v-if="!companyNatureData.length">
                    🏢 <strong>企业性质</strong>：后端未生成企业性质分析数据
                  </li>
                  <li v-if="!companyScaleData.length">
                    📈 <strong>公司规模</strong>：后端未生成公司规模分析数据
                  </li>
                </ul>
                <p class="diagnosis-tip">
                  💡 <strong>提示：</strong>打开浏览器控制台（F12）查看详细的数据匹配日志
                </p>
              </div>
            </template>
          </el-alert>
        </div>
      </div>
    </el-card>

    <!-- 可视化图表区域 - 动态网格布局 -->
    <div v-if="!loading && analysisResult && availableCharts.length > 0" class="charts-section">
      <el-row :gutter="20">
        <el-col 
          v-for="chart in availableCharts" 
          :key="chart.id"
          :span="availableCharts.length === 1 ? 24 : availableCharts.length === 2 ? 12 : availableCharts.length <= 4 ? 12 : 8"
          class="chart-col"
        >
          <el-card class="chart-card">
            <div :id="`${chart.id}-chart`" style="width: 100%; height: 400px;"></div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <el-empty v-if="!loading && !analysisResult" description="请从任务列表点击'分析'按钮查看数据分析" />
    <el-empty v-if="!loading && analysisResult && availableCharts.length === 0" description="暂无可展示的图表数据" />
  </div>
</template>

<style scoped>
.analysis-page {
  padding: 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.mb-4 {
  margin-bottom: 20px;
}

.info-card {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.info-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
}

/* 统计卡片样式 */
.overview-section {
  margin-top: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 10px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  font-size: 40px;
  margin-right: 15px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-primary .stat-value {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-success .stat-value {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-warning .stat-value {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-info .stat-value {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 智能洞察样式 */
.insights-section {
  margin-top: 30px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 10px;
  border-left: 4px solid #409EFF;
}

.insight-card {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  background: white;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.insight-card:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.insight-info {
  border-left-color: #409EFF;
}

.insight-success {
  border-left-color: #67C23A;
}

.insight-warning {
  border-left-color: #E6A23C;
}

.insight-danger {
  border-left-color: #F56C6C;
}

.insight-icon {
  font-size: 32px;
  margin-right: 12px;
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-size: 15px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 6px;
}

.insight-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

/* 数据诊断面板样式 */
.diagnosis-section {
  margin-top: 24px;
}

.diagnosis-title {
  border-left-color: #909399;
}

.diagnosis-content {
  padding: 8px 0;
}

.diagnosis-content p {
  margin: 8px 0;
  font-size: 14px;
  color: #606266;
}

.diagnosis-list {
  margin: 12px 0;
  padding-left: 20px;
  list-style: none;
}

.diagnosis-list li {
  margin: 8px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  padding-left: 8px;
}

.diagnosis-list li strong {
  color: #303133;
}

.diagnosis-tip {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f4f4f5;
  border-radius: 4px;
  font-size: 13px;
  color: #909399;
}

/* 图表区域样式 */
.charts-section {
  margin-top: 20px;
}

.chart-row {
  margin-bottom: 20px;
}

.chart-col {
  margin-bottom: 20px;
  transition: all 0.3s ease;
}

.chart-card {
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  height: 100%;
}

.chart-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.loading-container {
  padding: 20px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .chart-col {
    flex: 0 0 50% !important;
    max-width: 50% !important;
  }
}

@media (max-width: 768px) {
  .stat-card {
    margin-bottom: 12px;
  }
  
  .stat-value {
    font-size: 22px;
  }
  
  .insight-card {
    margin-bottom: 10px;
  }
  
  .chart-col {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  
  #salary-chart,
  #city-chart,
  #position-chart,
  #experience-chart,
  #education-chart,
  #company-nature-chart,
  #company-scale-chart {
    height: 350px !important;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 16px;
  }
  
  .stat-value {
    font-size: 18px;
  }
  
  .section-title {
    font-size: 16px;
  }
}
</style>
