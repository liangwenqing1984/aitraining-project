<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import { fetchOverview, type DashboardOverview } from '@/api/dashboard';
import { fetchRegionStats, type RegionStats } from '@/api/region';

const loading = ref(true);
const error = ref('');
const data = ref<DashboardOverview | null>(null);

// ==================== 区域分布（黑龙江地图）====================
const regionLoading = ref(true);
const regionError = ref('');
const regionStats = ref<RegionStats | null>(null);
const activeDim = ref('city');
const mapDom = ref<HTMLDivElement>();
const barDom = ref<HTMLDivElement>();
let geoJsonLoaded = false;
let mapChart: echarts.ECharts | null = null;
let barChart: echarts.ECharts | null = null;

// ECharts instances
const charts: Record<string, echarts.ECharts> = {};

// 直接用 data-chart 属性 + querySelector，绕过 Vue ref 绑定时序问题
function getDom(key: string): HTMLElement | null {
  return document.querySelector(`[data-chart="${key}"]`);
}

function formatSalary(val: number): string {
  return val >= 1000 ? `${(val / 1000).toFixed(0)}K` : String(val);
}

function initChart(key: string, option: any) {
  try {
    const dom = getDom(key);
    if (!dom) { console.warn(`[Dashboard] chart ${key} DOM not found`); return; }
    if (charts[key]) charts[key].dispose();
    const instance = echarts.init(dom);
    instance.setOption(option);
    charts[key] = instance;
  } catch (e) {
    console.error(`[Dashboard] chart ${key} init failed:`, e);
  }
}

function initCharts() {
  if (!data.value) return;

  const { salaryDistribution, cityDistribution, educationDistribution,
    experienceDistribution, industryDistribution, categoryDistribution,
    topSkills, workModeDistribution } = data.value;

  // ====== 薪资分布 ======
  initChart('salary', {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: salaryDistribution.map(d => d.label), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '职位数' },
    series: [{
      type: 'bar', data: salaryDistribution.map(d => d.count),
      itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#409eff' }, { offset: 1, color: '#79bbff' }]) },
      barWidth: '55%',
    }],
  });

  // ====== 城市分布 ======
  const cities = cityDistribution.slice(0, 10).reverse();
  initChart('city', {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: { type: 'value', name: '职位数' },
    yAxis: { type: 'category', data: cities.map(d => d.name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: cities.map(d => d.count),
      itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#67c23a' }, { offset: 1, color: '#b3e19d' }]) },
      barWidth: '55%',
    }],
  });

  // ====== 学历分布 ======
  initChart('education', {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '55%'],
      data: educationDistribution.map(d => ({ name: d.name, value: d.count })),
      label: { fontSize: 11, formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    }],
    color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6', '#00b8ba'],
  });

  // ====== 经验分布 ======
  initChart('experience', {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: experienceDistribution.map(d => d.name), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', name: '职位数' },
    series: [{
      type: 'bar', data: experienceDistribution.map(d => d.count),
      itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#e6a23c' }, { offset: 1, color: '#f3d19e' }]) },
      barWidth: '50%',
    }],
  });

  // ====== 行业分布 ======
  const industries = industryDistribution.slice(0, 10).reverse();
  initChart('industry', {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        const item = industryDistribution.find(d => d.name === p.name);
        return `${p.name}<br/>职位数: ${p.value}<br/>平均薪资: ${item ? formatSalary(item.avgSalary) : '-'}`;
      },
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: { type: 'value', name: '职位数' },
    yAxis: { type: 'category', data: industries.map(d => d.name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: industries.map(d => d.count),
      itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#9b59b6' }, { offset: 1, color: '#c9a0dc' }]) },
      barWidth: '55%',
    }],
  });

  // ====== 职位分类 ======
  initChart('category', {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '55%'],
      data: categoryDistribution.map(d => ({ name: d.name, value: d.count })),
      label: { fontSize: 10, formatter: '{b}\n{d}%' },
      itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 },
    }],
    color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6', '#00b8ba', '#fd726d', '#79bbff', '#b88230', '#8b5cf6', '#06b6d4', '#84cc16'],
  });

  // ====== 工作模式 ======
  initChart('workMode', {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: '65%', center: ['50%', '55%'],
      data: workModeDistribution.map(d => ({ name: d.name, value: d.count })),
      label: { fontSize: 11, formatter: '{b}\n{d}%' },
      itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 },
    }],
    color: ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6'],
  });

  // ====== 热门技能 Top 15 ======
  const skills = topSkills.slice(0, 15).reverse();
  initChart('skills', {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: { type: 'value', name: '出现次数' },
    yAxis: { type: 'category', data: skills.map(d => d.name), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: skills.map(d => d.count),
      itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f56c6c' }, { offset: 1, color: '#fab6b6' }]) },
      barWidth: '55%',
    }],
  });
}

function resizeCharts() {
  Object.values(charts).forEach(c => c.resize());
  mapChart?.resize();
  barChart?.resize();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const raw = await fetchOverview();
    const n = (v: any) => Number(v) || 0;
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
    };
    // 必须先关闭 loading，否则 v-if="loading" 导致图表 DOM 不渲染
    loading.value = false;
    await nextTick();
    initCharts();
  } catch (e: any) {
    loading.value = false;
    error.value = e.message || '加载失败';
  }
}

// ==================== 区域分布 ====================
async function loadGeoJSON(): Promise<any> {
  const resp = await fetch('/230000_full.json');
  const geojson = await resp.json();
  echarts.registerMap('heilongjiang', geojson);
  geoJsonLoaded = true;
  return geojson;
}

async function switchRegionDim(dim: string) {
  if (activeDim.value === dim) return;
  activeDim.value = dim;
  regionLoading.value = true;
  try {
    const data = await fetchRegionStats(dim);
    regionStats.value = data;
  } catch (e: any) {
    regionError.value = e.message || '加载失败';
  } finally {
    regionLoading.value = false;
    await nextTick();
    renderRegionCharts();
  }
}

function renderRegionCharts() {
  if (!regionStats.value || !geoJsonLoaded) return;
  const { mapData, breakdown } = regionStats.value;

  if (mapDom.value) {
    if (mapChart) mapChart.dispose();
    mapChart = echarts.init(mapDom.value);
    mapChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const extra = Object.entries(params.data || {})
            .filter(([k]) => !['name', 'value', 'selected'].includes(k))
            .map(([k, v]) => `<br/>${k}: ${v}`)
            .join('');
          return `<strong>${params.name}</strong><br/>${activeDim.value === 'salary' ? '平均薪资' : '数量'}: ${typeof params.value === 'number' ? params.value.toLocaleString() : params.value}${extra}`;
        },
      },
      visualMap: {
        left: 'right', top: 'center',
        min: 0,
        max: Math.max(...mapData.map(d => d.value || 0), 1),
        text: activeDim.value === 'salary' ? ['高', '低'] : ['多', '少'],
        calculable: true,
        inRange: { color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'] },
      },
      series: [{
        type: 'map', map: 'heilongjiang',
        roam: true, zoom: 1.1, center: [127.5, 47.5],
        label: { show: true, fontSize: 11, color: '#333' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, itemStyle: { areaColor: '#fbb040' } },
        data: mapData.map(d => ({ name: d.name, value: d.value, ...Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'name' && k !== 'value')) })),
      }],
    });
  }

  if (barDom.value && breakdown.length > 0) {
    if (barChart) barChart.dispose();
    barChart = echarts.init(barDom.value);
    const bars = breakdown.slice(0, 12);
    barChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '10%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { type: 'value', name: activeDim.value === 'salary' ? '职位数' : '数量' },
      yAxis: { type: 'category', data: bars.map(d => d.label).reverse(), axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar',
        data: bars.map(d => d.value).reverse(),
        itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#4575b4' }, { offset: 1, color: '#74add1' }]) },
        barWidth: '50%',
        label: { show: true, position: 'right', fontSize: 11 },
      }],
    });
  }
}

async function loadRegion() {
  regionLoading.value = true;
  regionError.value = '';
  try {
    if (!geoJsonLoaded) await loadGeoJSON();
    const data = await fetchRegionStats('city');
    regionStats.value = data;
    regionLoading.value = false;
    await nextTick();
    renderRegionCharts();
  } catch (e: any) {
    regionLoading.value = false;
    regionError.value = e.message || '加载失败';
  }
}

onMounted(async () => {
  await load();         // 等 dashboard 数据加载完、DOM 渲染后再加载区域地图
  loadRegion();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  Object.values(charts).forEach(c => c.dispose());
  mapChart?.dispose();
  barChart?.dispose();
});
</script>

<template>
  <div class="dashboard">
    <!-- 加载状态 -->
    <div v-if="loading" class="dash-loading">
      <div class="loading-spinner"></div>
      <span>正在加载数据看板...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="dash-error">
      <span>{{ error }}</span>
      <el-button type="primary" @click="load">重试</el-button>
    </div>

    <!-- 看板内容 -->
    <template v-else-if="data">
      <!-- 顶部统计卡片 -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-value">{{ data.summary.totalJobs.toLocaleString() }}</div>
          <div class="stat-label">总职位数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.summary.totalTasks }}</div>
          <div class="stat-label">采集任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.summary.totalCompanies.toLocaleString() }}</div>
          <div class="stat-label">企业数量</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ formatSalary(data.summary.avgSalary) }}</div>
          <div class="stat-label">平均薪资</div>
        </div>
        <div class="stat-card accent-high">
          <div class="stat-value">{{ formatSalary(data.summary.maxSalary) }}</div>
          <div class="stat-label">最高薪资</div>
        </div>
      </div>

      <!-- ==================== 黑龙江省数据地图 ==================== -->
      <div class="section-divider"><span>黑龙江省区域分布</span></div>

      <div v-if="regionLoading" class="dash-loading" style="height:200px">
        <div class="loading-spinner"></div>
        <span>正在加载黑龙江地图...</span>
      </div>
      <div v-else-if="regionError" class="dash-error" style="height:200px">
        <span>{{ regionError }}</span>
        <el-button type="primary" @click="loadRegion">重试</el-button>
      </div>
      <template v-else-if="regionStats">
        <div class="dim-tabs">
          <button
            v-for="dim in regionStats.dimensions"
            :key="dim.key"
            :class="{ active: activeDim === dim.key }"
            @click="switchRegionDim(dim.key)"
          >{{ dim.label }}</button>
        </div>

        <div class="chart-row">
          <div class="chart-panel map-panel">
            <h3>黑龙江省{{ regionStats.dimensions.find(d => d.key === activeDim)?.label }}</h3>
            <div ref="mapDom" class="chart-box"></div>
          </div>
          <div class="chart-panel bar-panel">
            <h3>{{ regionStats.dimensions.find(d => d.key === activeDim)?.label }}明细</h3>
            <div ref="barDom" class="chart-box"></div>
          </div>
        </div>
      </template>

      <!-- 图表区域 -->
      <div class="chart-grid chart-grid-2">
        <!-- 薪资分布 -->
        <div class="chart-card">
          <h3 class="chart-title">薪资分布</h3>
          <div data-chart="salary" class="chart-box"></div>
        </div>

        <!-- 城市分布 -->
        <div class="chart-card">
          <h3 class="chart-title">城市热力 TOP10</h3>
          <div data-chart="city" class="chart-box"></div>
        </div>
      </div>

      <div class="chart-grid chart-grid-3">
        <!-- 学历分布 -->
        <div class="chart-card">
          <h3 class="chart-title">学历要求</h3>
          <div data-chart="education" class="chart-box"></div>
        </div>

        <!-- 经验分布 -->
        <div class="chart-card">
          <h3 class="chart-title">经验年限</h3>
          <div data-chart="experience" class="chart-box"></div>
        </div>

        <!-- 工作模式 -->
        <div class="chart-card">
          <h3 class="chart-title">工作模式</h3>
          <div data-chart="workMode" class="chart-box"></div>
        </div>
      </div>

      <div class="chart-grid chart-grid-2">
        <!-- 行业分布 -->
        <div class="chart-card">
          <h3 class="chart-title">行业分布 TOP10</h3>
          <div data-chart="industry" class="chart-box"></div>
        </div>

        <!-- 职位分类 -->
        <div class="chart-card">
          <h3 class="chart-title">职位分类</h3>
          <div data-chart="category" class="chart-box"></div>
        </div>
      </div>

      <div class="chart-grid chart-grid-1">
        <!-- 热门技能 -->
        <div class="chart-card">
          <h3 class="chart-title">热门技能 TOP15</h3>
          <div data-chart="skills" class="chart-box"></div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.dashboard {
  height: 100%;
  overflow-y: auto;
  padding: 4px 0;
}

.dash-loading, .dash-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 16px;
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 统计卡片行 */
.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f0f0f0;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-card.accent .stat-value { color: #409eff; }
.stat-card.accent-high .stat-value { color: #f56c6c; }

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* 图表网格 */
.chart-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}
.chart-grid-1 { grid-template-columns: 1fr; }
.chart-grid-2 { grid-template-columns: repeat(2, 1fr); }
.chart-grid-3 { grid-template-columns: repeat(3, 1fr); }

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f0f0f0;
  height: 400px;
  display: flex;
  flex-direction: column;
}

.chart-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
  height: 24px;
  line-height: 24px;
}

.chart-box {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* ==================== 区域分布 ==================== */
.section-divider {
  display: flex;
  align-items: center;
  margin: 24px 0 16px;
  color: #909399;
  font-size: 13px;
}
.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #ebeef5;
}
.section-divider span {
  padding: 0 16px;
}

.dim-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.dim-tabs button {
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.2s;
}
.dim-tabs button:hover { border-color: #4575b4; color: #4575b4; }
.dim-tabs button.active { background: #4575b4; color: #fff; border-color: #4575b4; }

.chart-row {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  height: 480px;
  margin-bottom: 16px;
}
.chart-panel {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}
.chart-panel h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .chart-row {
    grid-template-columns: 1fr;
    height: auto;
  }
  .chart-panel { height: 360px; }
}
</style>
