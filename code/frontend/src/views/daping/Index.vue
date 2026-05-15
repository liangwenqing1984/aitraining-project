<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import 'echarts-wordcloud'
import {
  Briefcase, Monitor, OfficeBuilding, Coin, Loading,
} from '@element-plus/icons-vue'
import { fetchOverview, type DashboardOverview } from '@/api/dashboard'
import { fetchRegionStats, type RegionStats } from '@/api/region'

const loading = ref(true)
const error = ref('')
const data = ref<DashboardOverview | null>(null)

// 实时时钟
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null

function formatTime(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}
function formatDate(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
function formatWeekDay(d: Date) {
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return names[d.getDay()]
}

function formatSalary(val: number): string {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : String(val)
}
function formatNum(val: number): string {
  return val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val.toLocaleString()
}

// ==================== 图表 refs ====================
const mapDom = ref<HTMLDivElement>()
const salaryDom = ref<HTMLDivElement>()
const industryDom = ref<HTMLDivElement>()
const educationDom = ref<HTMLDivElement>()
const skillsDom = ref<HTMLDivElement>()
const experienceDom = ref<HTMLDivElement>()
const cityDom = ref<HTMLDivElement>()
const focusDom = ref<HTMLDivElement>()

let charts: echarts.ECharts[] = []
let mapChart: echarts.ECharts | null = null
let focusChart: echarts.ECharts | null = null
let geoJsonLoaded = false

// 悬停放大状态
const focusedPanel = ref<string | null>(null)
const focusTitle = ref('')
let clearFocusTimer: ReturnType<typeof setTimeout> | null = null

// 科技蓝主题色
const CYAN = '#00d4ff'
const BLUE = '#1e80ff'
const PURPLE = '#a855f7'

function darkChartOption(base: any): any {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8' },
    ...base,
  }
}

// ==================== 渲染所有统计图表 ====================
function renderAllCharts() {
  if (!data.value) return
  disposeAllCharts()
  const d = data.value

  // 薪资分布柱状图
  if (salaryDom.value) {
    const c = echarts.init(salaryDom.value)
    c.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '12%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: d.salaryDistribution.map(i => i.label),
        axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [{
        type: 'bar',
        data: d.salaryDistribution.map(i => i.count),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CYAN }, { offset: 1, color: 'rgba(0,212,255,0.2)' },
          ]),
        },
        barWidth: '50%',
      }],
    }))
    charts.push(c)
  }

  // 行业分布横向柱状图
  if (industryDom.value) {
    const top10 = [...d.industryDistribution].sort((a, b) => b.count - a.count).slice(0, 10)
    const c = echarts.init(industryDom.value)
    c.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '15%', top: '12%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'category',
        data: top10.map(i => i.name).reverse(),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      series: [{
        type: 'bar',
        data: top10.map(i => i.count).reverse(),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: BLUE }, { offset: 1, color: CYAN },
          ]),
        },
        barWidth: '55%',
        label: { show: true, position: 'right', fontSize: 10, color: '#94a3b8' },
      }],
    }))
    charts.push(c)
  }

  // 学历分布饼图
  if (educationDom.value) {
    const c = echarts.init(educationDom.value)
    c.setOption(darkChartOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '55%'],
        itemStyle: { borderRadius: 4, borderColor: '#0a1628', borderWidth: 3 },
        label: { color: '#94a3b8', fontSize: 10 },
        data: d.educationDistribution.map(i => ({
          name: i.name, value: i.count,
          itemStyle: {
            color: ['大专', '高中及以下'].includes(i.name) ? '#475569' :
                   i.name === '本科' ? CYAN : i.name === '硕士' ? BLUE : PURPLE,
          },
        })),
      }],
    }))
    charts.push(c)
  }

  // 技能词云
  renderSkillsChart()

  // 经验年限分布
  if (experienceDom.value) {
    const c = echarts.init(experienceDom.value)
    c.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '12%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: d.experienceDistribution.map(i => i.name),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [{
        type: 'bar',
        data: d.experienceDistribution.map(i => i.count),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: PURPLE }, { offset: 1, color: 'rgba(168,85,247,0.2)' },
          ]),
        },
        barWidth: '50%',
      }],
    }))
    charts.push(c)
  }

  // 城市分布
  if (cityDom.value) {
    const top8 = [...d.cityDistribution].sort((a, b) => b.count - a.count).slice(0, 8)
    const c = echarts.init(cityDom.value)
    c.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '15%', top: '12%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'category',
        data: top8.map(i => i.name).reverse(),
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      series: [{
        type: 'bar',
        data: top8.map(i => i.count).reverse(),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#38bdf8' }, { offset: 1, color: CYAN },
          ]),
        },
        barWidth: '55%',
        label: { show: true, position: 'right', fontSize: 10, color: '#94a3b8' },
      }],
    }))
    charts.push(c)
  }
}

function disposeAllCharts() {
  charts.forEach(c => { try { c.dispose() } catch { /* ignore */ } })
  charts = []
  if (mapChart) { try { mapChart.dispose() } catch { /* ignore */ } mapChart = null }
  if (focusChart) { try { focusChart.dispose() } catch { /* ignore */ } focusChart = null }
}

// ==================== 技能词云（独立函数，支持重新渲染） ====================
function renderSkillsChart() {
  if (!skillsDom.value || !data.value) return
  const existing = echarts.getInstanceByDom(skillsDom.value)
  if (existing) existing.dispose()
  const c = echarts.init(skillsDom.value)
  c.setOption(darkChartOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 次' },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      width: '100%',
      height: '100%',
      sizeRange: [13, 40],
      rotationRange: [-45, 45],
      rotationStep: 45,
      gridSize: 8,
      drawOutOfBound: false,
      layoutAnimation: true,
      keepAspect: true,
      textStyle: {
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
        color() {
          const colors = [CYAN, BLUE, PURPLE, '#38bdf8', '#818cf8', '#22d3ee']
          return colors[Math.floor(Math.random() * colors.length)]
        },
      },
      emphasis: { textStyle: { fontSize: 48, color: CYAN } },
      data: data.value.topSkills.slice(0, 60).map(s => ({ name: s.name, value: s.count })),
    }],
  }))
  charts = charts.filter(ch => { try { return ch.getDom() !== skillsDom.value } catch { return true } })
  charts.push(c)
}

// ==================== 悬停放大：在中间区域渲染聚焦图表 ====================
const panelMeta: Record<string, { title: string }> = {
  salary: { title: '薪资分布' },
  education: { title: '学历分布' },
  industry: { title: '行业 Top 10' },
  experience: { title: '经验年限分布' },
  city: { title: '城市 Top 8' },
  skills: { title: '热门技能词云' },
}

function renderFocusChart(type: string) {
  if (!focusDom.value || !data.value) return
  const d = data.value
  if (focusChart) focusChart.dispose()
  focusChart = echarts.init(focusDom.value)
  focusTitle.value = panelMeta[type]?.title || ''

  if (type === 'salary') {
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '10%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category', data: d.salaryDistribution.map(i => i.label),
        axisLabel: { color: '#94a3b8', fontSize: 12, rotate: 30 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [{
        type: 'bar', barWidth: '40%',
        data: d.salaryDistribution.map(i => i.count),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CYAN }, { offset: 1, color: 'rgba(0,212,255,0.15)' },
          ]),
        },
        label: { show: true, position: 'top', color: '#94a3b8', fontSize: 12 },
      }],
    }))
  } else if (type === 'education') {
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        itemStyle: { borderRadius: 6, borderColor: '#0a1628', borderWidth: 4 },
        label: { color: '#94a3b8', fontSize: 13 },
        emphasis: { label: { fontSize: 20, fontWeight: 'bold' } },
        data: d.educationDistribution.map(i => ({
          name: i.name, value: i.count,
          itemStyle: {
            color: ['大专', '高中及以下'].includes(i.name) ? '#475569' :
                   i.name === '本科' ? CYAN : i.name === '硕士' ? BLUE : PURPLE,
          },
        })),
      }],
    }))
  } else if (type === 'industry') {
    const top15 = [...d.industryDistribution].sort((a, b) => b.count - a.count).slice(0, 15)
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '12%', top: '10%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'category', data: top15.map(i => i.name).reverse(),
        axisLabel: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      series: [{
        type: 'bar', barWidth: '50%',
        data: top15.map(i => i.count).reverse(),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: BLUE }, { offset: 1, color: CYAN },
          ]),
        },
        label: { show: true, position: 'right', fontSize: 12, color: '#94a3b8' },
      }],
    }))
  } else if (type === 'experience') {
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', top: '10%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category', data: d.experienceDistribution.map(i => i.name),
        axisLabel: { color: '#94a3b8', fontSize: 12, rotate: 30 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      series: [{
        type: 'bar', barWidth: '40%',
        data: d.experienceDistribution.map(i => i.count),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: PURPLE }, { offset: 1, color: 'rgba(168,85,247,0.15)' },
          ]),
        },
        label: { show: true, position: 'top', color: '#94a3b8', fontSize: 12 },
      }],
    }))
  } else if (type === 'city') {
    const top12 = [...d.cityDistribution].sort((a, b) => b.count - a.count).slice(0, 12)
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '12%', top: '10%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'value', name: '职位数',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'category', data: top12.map(i => i.name).reverse(),
        axisLabel: { color: '#94a3b8', fontSize: 12 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      series: [{
        type: 'bar', barWidth: '50%',
        data: top12.map(i => i.count).reverse(),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#38bdf8' }, { offset: 1, color: CYAN },
          ]),
        },
        label: { show: true, position: 'right', fontSize: 12, color: '#94a3b8' },
      }],
    }))
  } else if (type === 'skills') {
    focusChart.setOption(darkChartOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} 次' },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        width: '100%',
        height: '100%',
        sizeRange: [16, 56],
        rotationRange: [-45, 45],
        rotationStep: 45,
        gridSize: 10,
        drawOutOfBound: false,
        layoutAnimation: true,
        keepAspect: true,
        textStyle: {
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          color() {
            const colors = [CYAN, BLUE, PURPLE, '#38bdf8', '#818cf8', '#22d3ee']
            return colors[Math.floor(Math.random() * colors.length)]
          },
        },
        emphasis: { textStyle: { fontSize: 64, color: CYAN } },
        data: d.topSkills.slice(0, 80).map(s => ({ name: s.name, value: s.count })),
      }],
    }))
  }
}

async function handlePanelEnter(type: string) {
  if (clearFocusTimer) { clearTimeout(clearFocusTimer); clearFocusTimer = null }
  focusedPanel.value = type
  await nextTick()
  renderFocusChart(type)
}

async function handlePanelLeave() {
  clearFocusTimer = setTimeout(async () => {
    focusedPanel.value = null
    if (focusChart) { focusChart.dispose(); focusChart = null }
    // 等 v-if 重新渲染地图 + 词云 DOM
    await nextTick()
    if (geoJsonLoaded) {
      const regionStats = await fetchRegionStats('city')
      renderMap(regionStats)
    }
    renderSkillsChart()
  }, 200)
}

async function loadGeoJSON(): Promise<any> {
  const resp = await fetch('/230000_full.json')
  const geojson = await resp.json()
  echarts.registerMap('heilongjiang', geojson)
  geoJsonLoaded = true
  return geojson
}

async function renderMap(regionStats: RegionStats) {
  if (!mapDom.value || !geoJsonLoaded) return
  const { mapData } = regionStats

  if (mapChart) mapChart.dispose()
  mapChart = echarts.init(mapDom.value)
  const maxVal = Math.max(...mapData.map(d => d.value || 0), 1)
  mapChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(6,14,26,0.95)',
      borderColor: 'rgba(0,212,255,0.3)',
      textStyle: { color: '#e2e8f0' },
      formatter: (params: any) => {
        const val = params.data?.value ?? params.value
        return `<strong style="color:#00d4ff">${params.name}</strong><br/>职位数: <span style="color:#fff;font-weight:bold;font-size:16px">${typeof val === 'number' ? val.toLocaleString() : val}</span>`
      },
    },
    visualMap: {
      left: 'right',
      top: 'center',
      min: 0,
      max: maxVal,
      text: ['多', '少'],
      textStyle: { color: '#94a3b8' },
      calculable: true,
      seriesIndex: 0,
      inRange: { color: ['#0b2545', '#13315c', '#1b3a6b', '#2251a0', '#2e6ed5', '#38bdf8', '#00d4ff'] },
    },
    series: [{
      type: 'map',
      map: 'heilongjiang',
      roam: true,
      zoom: 1.15,
      center: [128.14, 49.0],
      label: { show: true, fontSize: 11, color: '#94a3b8' },
      itemStyle: {
        areaColor: '#1b3a6b',
        borderColor: '#0a3a6b',
        borderWidth: 1,
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
        itemStyle: { areaColor: '#00d4ff', shadowBlur: 20, shadowColor: 'rgba(0,212,255,0.6)' },
      },
      data: mapData.map(d => {
        const rest = Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'name' && k !== 'value'))
        return { name: d.name, value: d.value, ...rest }
      }),
    }],
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const raw = await fetchOverview()
    const n = (v: any) => Number(v) || 0
    data.value = {
      summary: {
        totalJobs: n(raw.summary.totalJobs),
        totalTasks: n(raw.summary.totalTasks),
        totalCompanies: n(raw.summary.totalCompanies),
        avgSalary: n(raw.summary.avgSalary),
        maxSalary: n(raw.summary.maxSalary),
        minSalary: n(raw.summary.minSalary),
      },
      salaryDistribution: raw.salaryDistribution.map(d => ({ ...d, count: n(d.count) })),
      cityDistribution: raw.cityDistribution.map(d => ({ name: d.name, count: n(d.count) })),
      educationDistribution: raw.educationDistribution.map(d => ({ name: d.name, count: n(d.count) })),
      experienceDistribution: raw.experienceDistribution.map(d => ({ name: d.name, count: n(d.count) })),
      industryDistribution: raw.industryDistribution.map(d => ({ name: d.name, count: n(d.count), avgSalary: n(d.avgSalary) })),
      categoryDistribution: raw.categoryDistribution.map(d => ({ name: d.name, count: n(d.count) })),
      topSkills: raw.topSkills.map(d => ({ name: d.name, count: n(d.count) })),
      workModeDistribution: raw.workModeDistribution.map(d => ({ name: d.name, count: n(d.count) })),
    }
    loading.value = false
    await nextTick()
    renderAllCharts()

    // 加载地图
    if (!geoJsonLoaded) await loadGeoJSON()
    const regionStats = await fetchRegionStats('city')
    await nextTick()
    renderMap(regionStats)
  } catch (e: any) {
    loading.value = false
    error.value = e.message || '加载失败'
  }
}

function resizeAll() {
  charts.forEach(c => { try { c.resize() } catch { /* ignore */ } })
  if (mapChart) { try { mapChart.resize() } catch { /* ignore */ } }
  if (focusChart) { try { focusChart.resize() } catch { /* ignore */ } }
}

onMounted(() => {
  load()
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  window.addEventListener('resize', resizeAll)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('resize', resizeAll)
  disposeAllCharts()
})
</script>

<template>
  <div class="daping">
    <!-- 加载中 -->
    <div v-if="loading" class="dp-loading">
      <div class="loading-ring"></div>
      <span>正在加载数据大屏...</span>
    </div>

    <!-- 错误 -->
    <div v-else-if="error" class="dp-error">
      <span>{{ error }}</span>
      <button class="dp-btn" @click="load">重试</button>
    </div>

    <!-- 大屏内容 -->
    <template v-else-if="data">
      <!-- 顶部标题栏 -->
      <div class="dp-header">
        <div class="dp-header-left">
          <div class="dp-header-deco"></div>
          <h1>招聘数据可视化大屏</h1>
        </div>
        <div class="dp-header-center">
          <span class="dp-subtitle">黑龙江省 · AI 智能分析平台</span>
        </div>
        <div class="dp-header-right">
          <span class="dp-date">{{ formatDate(now) }}</span>
          <span class="dp-weekday">{{ formatWeekDay(now) }}</span>
          <span class="dp-time">{{ formatTime(now) }}</span>
        </div>
      </div>

      <!-- 主内容区域：CSS Grid 布局 -->
      <div class="dp-grid">
        <!-- ===== 左侧列：统计卡片 2x2 + 薪资分布 + 学历分布 ===== -->
        <div class="dp-col dp-col-left">
          <!-- 4 个核心指标卡片 2x2 -->
          <div class="dp-stat-grid">
            <div class="dp-stat-card">
              <div class="dp-stat-icon" style="color:#00d4ff;box-shadow:0 0 16px rgba(0,212,255,0.3)">
                <el-icon :size="20"><Briefcase /></el-icon>
              </div>
              <div class="dp-stat-info">
                <div class="dp-stat-value">{{ formatNum(data.summary.totalJobs) }}</div>
                <div class="dp-stat-label">总职位数</div>
              </div>
            </div>
            <div class="dp-stat-card">
              <div class="dp-stat-icon" style="color:#22d3ee;box-shadow:0 0 16px rgba(34,211,238,0.3)">
                <el-icon :size="20"><Monitor /></el-icon>
              </div>
              <div class="dp-stat-info">
                <div class="dp-stat-value">{{ data.summary.totalTasks }}</div>
                <div class="dp-stat-label">采集任务</div>
              </div>
            </div>
            <div class="dp-stat-card">
              <div class="dp-stat-icon" style="color:#818cf8;box-shadow:0 0 16px rgba(129,140,248,0.3)">
                <el-icon :size="20"><OfficeBuilding /></el-icon>
              </div>
              <div class="dp-stat-info">
                <div class="dp-stat-value">{{ formatNum(data.summary.totalCompanies) }}</div>
                <div class="dp-stat-label">企业数量</div>
              </div>
            </div>
            <div class="dp-stat-card">
              <div class="dp-stat-icon" style="color:#fbbf24;box-shadow:0 0 16px rgba(251,191,36,0.3)">
                <el-icon :size="20"><Coin /></el-icon>
              </div>
              <div class="dp-stat-info">
                <div class="dp-stat-value accent-gold">{{ formatSalary(data.summary.avgSalary) }}</div>
                <div class="dp-stat-label">平均薪资</div>
              </div>
            </div>
          </div>

          <!-- 薪资分布（从右侧移入） -->
          <div class="dp-panel dp-panel-salary" @mouseenter="handlePanelEnter('salary')" @mouseleave="handlePanelLeave">
            <div class="dp-panel-title">
              <span class="dp-panel-dot"></span>薪资分布
            </div>
            <div ref="salaryDom" class="dp-chart"></div>
          </div>

          <!-- 学历分布饼图 -->
          <div class="dp-panel dp-panel-edu" @mouseenter="handlePanelEnter('education')" @mouseleave="handlePanelLeave">
            <div class="dp-panel-title">
              <span class="dp-panel-dot"></span>学历分布
            </div>
            <div ref="educationDom" class="dp-chart"></div>
          </div>
        </div>

        <!-- ===== 中间列：地图 + 技能词云 / 悬停放大 ===== -->
        <div class="dp-col dp-col-center">
          <!-- 悬停放大面板 -->
          <div v-if="focusedPanel" class="dp-panel dp-panel-focus">
            <div class="dp-panel-title">
              <span class="dp-panel-dot" style="background:#fbbf24;box-shadow:0 0 8px rgba(251,191,36,0.6)"></span>
              {{ focusTitle }}
              <span class="dp-focus-hint">（悬停放大中）</span>
            </div>
            <div ref="focusDom" class="dp-chart"></div>
          </div>

          <!-- 默认：地图 + 技能词云 -->
          <template v-else>
            <div class="dp-panel dp-panel-map">
              <div class="dp-panel-title">
                <span class="dp-panel-dot"></span>黑龙江省区域分布热力图
              </div>
              <div ref="mapDom" class="dp-chart dp-chart-map"></div>
            </div>

            <div class="dp-panel dp-panel-skills" @mouseenter="handlePanelEnter('skills')" @mouseleave="handlePanelLeave">
              <div class="dp-panel-title">
                <span class="dp-panel-dot"></span>热门技能词云
              </div>
              <div ref="skillsDom" class="dp-chart"></div>
            </div>
          </template>
        </div>

        <!-- ===== 右侧列：行业 + 经验 + 城市 ===== -->
        <div class="dp-col dp-col-right">
          <div class="dp-panel dp-panel-industry" @mouseenter="handlePanelEnter('industry')" @mouseleave="handlePanelLeave">
            <div class="dp-panel-title">
              <span class="dp-panel-dot"></span>行业 Top 10
            </div>
            <div ref="industryDom" class="dp-chart"></div>
          </div>

          <div class="dp-panel dp-panel-exp" @mouseenter="handlePanelEnter('experience')" @mouseleave="handlePanelLeave">
            <div class="dp-panel-title">
              <span class="dp-panel-dot"></span>经验年限分布
            </div>
            <div ref="experienceDom" class="dp-chart"></div>
          </div>

          <div class="dp-panel dp-panel-city" @mouseenter="handlePanelEnter('city')" @mouseleave="handlePanelLeave">
            <div class="dp-panel-title">
              <span class="dp-panel-dot"></span>城市 Top 8
            </div>
            <div ref="cityDom" class="dp-chart"></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ==================== 全局大屏容器 ==================== */
.daping {
  position: fixed;
  inset: 0;
  background: #060e1a;
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba(0,132,255,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(0,212,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 0%, rgba(30,128,255,0.04) 0%, transparent 50%);
  color: #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 网格背景纹理 */
.daping::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

/* ==================== 加载 / 错误状态 ==================== */
.dp-loading, .dp-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  color: #64748b;
  font-size: 14px;
}

.loading-ring {
  width: 48px;
  height: 48px;
  border: 3px solid transparent;
  border-top-color: #00d4ff;
  border-right-color: #00d4ff;
  border-radius: 50%;
  animation: ring-spin 1s linear infinite;
}
@keyframes ring-spin { to { transform: rotate(360deg); } }

.dp-btn {
  padding: 10px 28px;
  background: linear-gradient(135deg, #1e80ff, #00d4ff);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: box-shadow 0.3s;
}
.dp-btn:hover {
  box-shadow: 0 0 20px rgba(0,212,255,0.5);
}

/* ==================== 顶部标题栏 ==================== */
.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 64px;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgba(0,20,60,0.9) 0%, rgba(6,14,26,0) 100%);
  border-bottom: 1px solid rgba(0,212,255,0.12);
}

.dp-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.dp-header-deco {
  width: 4px;
  height: 24px;
  background: linear-gradient(180deg, #00d4ff, #1e80ff);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(0,212,255,0.5);
}

.dp-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(90deg, #e2e8f0, #00d4ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 2px;
}

.dp-subtitle {
  font-size: 13px;
  color: #64748b;
  letter-spacing: 1px;
}

.dp-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: #94a3b8;
}

.dp-date {
  color: #64748b;
}

.dp-weekday {
  color: #00d4ff;
  font-weight: 500;
}

.dp-time {
  font-size: 22px;
  font-weight: 700;
  color: #00d4ff;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  text-shadow: 0 0 12px rgba(0,212,255,0.4);
  min-width: 80px;
  text-align: right;
}

/* ==================== Grid 布局 ==================== */
.dp-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  gap: 12px;
  padding: 12px;
  min-height: 0;
}

.dp-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* ==================== 统计卡片网格 2x2 ==================== */
.dp-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex-shrink: 0;
}

/* ==================== 统计卡片 ==================== */
.dp-stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(15,30,60,0.8), rgba(10,25,50,0.6));
  border: 1px solid rgba(0,212,255,0.12);
  border-radius: 8px;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.dp-stat-card:hover {
  border-color: rgba(0,212,255,0.35);
  box-shadow: 0 0 20px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.03);
}

.dp-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(0,212,255,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dp-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.2;
  letter-spacing: 1px;
}
.dp-stat-value.accent-gold { color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.4); }
.dp-stat-value.accent-pink { color: #f472b6; text-shadow: 0 0 12px rgba(244,114,182,0.4); }

.dp-stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* ==================== 面板通用 ==================== */
.dp-panel {
  background: linear-gradient(135deg, rgba(15,30,60,0.7), rgba(10,25,50,0.5));
  border: 1px solid rgba(0,212,255,0.1);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dp-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dp-panel-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #00d4ff;
  box-shadow: 0 0 8px rgba(0,212,255,0.6);
  flex-shrink: 0;
}

.dp-chart {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* 各面板高度分配 */
.dp-panel-edu { flex: 1; }
.dp-panel-map { flex: 2.2; }
.dp-panel-skills { flex: 1; }
.dp-panel-salary { flex: 1.1; }
.dp-panel-industry { flex: 1.3; }
.dp-panel-exp { flex: 1; }
.dp-panel-city { flex: 1; }
.dp-panel-focus {
  flex: 1;
  border-color: rgba(251,191,36,0.35) !important;
  box-shadow: 0 0 30px rgba(0,212,255,0.15), inset 0 0 30px rgba(0,212,255,0.04);
}

.dp-focus-hint {
  font-size: 11px;
  font-weight: 400;
  color: #fbbf24;
  margin-left: 4px;
  animation: hint-pulse 2s ease-in-out infinite;
}
@keyframes hint-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.dp-chart-map {
  min-height: 300px;
}

/* 侧边面板 hover 微提示 */
.dp-col-left .dp-panel:hover,
.dp-col-right .dp-panel:hover {
  border-color: rgba(0,212,255,0.35) !important;
  box-shadow: 0 0 16px rgba(0,212,255,0.1);
}
</style>
