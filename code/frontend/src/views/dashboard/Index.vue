<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import { fetchOverview, type DashboardOverview } from '@/api/dashboard';

const loading = ref(true);
const error = ref('');
const data = ref<DashboardOverview | null>(null);

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
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const raw = await fetchOverview();
    // 数值归一化：PG 驱动可能返回字符串类型的 COUNT/AVG 结果
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
    await nextTick();
    initCharts();
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  Object.values(charts).forEach(c => c.dispose());
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
</style>
