<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import { Briefcase, Monitor, OfficeBuilding, Coin, TrendCharts, MagicStick, Download, RefreshLeft, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { fetchOverview, type DashboardOverview } from '@/api/dashboard';
import {
  generateDashboardInsights, getDashboardInsightsHistory,
  getDashboardInsightReport, getDashboardInsightPdfUrl,
  type InsightReport, type InsightSection,
} from '@/api/dashboard';
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

// ==================== AI 全量洞察 ====================
const insightsLoading = ref(false);
const generatingInsight = ref(false);
const insightsHistory = ref<InsightReport[]>([]);
const currentInsight = ref<InsightReport | null>(null);

function formatSalary(val: number): string {
  return val >= 1000 ? `${(val / 1000).toFixed(0)}K` : String(val);
}

function renderAnalysisChart() {
  if (!data.value || !barDom.value) return;
  // 保留左侧地图，仅更新右侧面板
  if (barChart) { barChart.dispose(); barChart = null; }

  if (activeDim.value === 'experience') {
    const { experienceDistribution } = data.value;
    barChart = echarts.init(barDom.value);
    barChart.setOption({
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
  } else {
    const { topSkills } = data.value;
    barChart = echarts.init(barDom.value);
    barChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} 次' },
      series: [{
        type: 'wordCloud',
        shape: 'circle',
        width: '100%',
        height: '100%',
        sizeRange: [14, 48],
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
            const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6', '#00b8ba', '#fd726d', '#79bbff'];
            return colors[Math.floor(Math.random() * colors.length)];
          },
        },
        emphasis: { textStyle: { fontSize: 52, color: '#f56c6c' } },
        data: topSkills.slice(0, 50).map(d => ({ name: d.name, value: d.count })),
      }],
    });
  }
}

function resizeCharts() {
  mapChart?.resize();
  barChart?.resize();
}

// ==================== AI 全量洞察 ====================

function parseContent(content: string): InsightSection[] {
  if (!content) return [];
  try {
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    return Array.isArray(content) ? content : [content];
  } catch {
    return [{ heading: '', body: content }];
  }
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text;
  html = html.replace(/((?:[|].+[|]\n)+)/g, (block) => {
    const lines = block.trim().split('\n').filter(l => l.includes('|'));
    if (lines.length < 2) return block;
    const dataLines = lines.filter(l => !/^\|[\s\-:]+\|$/.test(l));
    if (dataLines.length === 0) return block;
    const headerCells = dataLines[0].split('|').filter(c => c.trim());
    const bodyLines = dataLines.slice(1);
    let tableHtml = '<table><thead><tr>';
    headerCells.forEach(c => { tableHtml += `<th>${c.trim()}</th>`; });
    tableHtml += '</tr></thead><tbody>';
    bodyLines.forEach(line => {
      const cells = line.split('|').filter(c => c.trim());
      tableHtml += '<tr>';
      cells.forEach((c) => { tableHtml += `<td>${c.trim()}</td>`; });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  });
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

async function loadInsightsHistory() {
  try {
    const res = await getDashboardInsightsHistory();
    insightsHistory.value = res;
    if (res.length > 0) {
      currentInsight.value = res[0];
    }
  } catch { /* ignore */ }
}

async function generateInsight() {
  generatingInsight.value = true;
  try {
    const report = await generateDashboardInsights();
    ElMessage.success('AI 洞察报告已生成');
    insightsHistory.value.unshift(report);
    currentInsight.value = report;
  } catch (e: any) {
    ElMessage.error(e.message || '报告生成失败');
  } finally {
    generatingInsight.value = false;
  }
}

async function viewReport(reportId: string) {
  try {
    const report = await getDashboardInsightReport(reportId);
    currentInsight.value = report;
  } catch (e: any) {
    ElMessage.error(e.message || '获取报告失败');
  }
}

function downloadPdf(reportId: string) {
  window.open(getDashboardInsightPdfUrl(reportId), '_blank');
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

  // 经验年限 / 技能词云 使用 dashboard 汇总数据，无需请求后端
  if (dim === 'experience' || dim === 'skills') {
    regionLoading.value = false;
    await nextTick();
    renderAnalysisChart();
    return;
  }

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
        roam: true, zoom: 1.05, center: [128.14, 49.0],
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
  await load();
  loadRegion();
  loadInsightsHistory();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
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
          <div class="stat-icon" style="background:#ecf5ff;color:#409eff"><el-icon :size="20"><Briefcase /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ data.summary.totalJobs.toLocaleString() }}</div>
            <div class="stat-label">总职位数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#f0f9eb;color:#67c23a"><el-icon :size="20"><Monitor /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ data.summary.totalTasks }}</div>
            <div class="stat-label">采集任务</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:#fef0f0;color:#f56c6c"><el-icon :size="20"><OfficeBuilding /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ data.summary.totalCompanies.toLocaleString() }}</div>
            <div class="stat-label">企业数量</div>
          </div>
        </div>
        <div class="stat-card accent">
          <div class="stat-icon" style="background:#fdf6ec;color:#e6a23c"><el-icon :size="20"><Coin /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ formatSalary(data.summary.avgSalary) }}</div>
            <div class="stat-label">平均薪资</div>
          </div>
        </div>
        <div class="stat-card accent-high">
          <div class="stat-icon" style="background:#e8fffe;color:#00b8ba"><el-icon :size="20"><TrendCharts /></el-icon></div>
          <div class="stat-text">
            <div class="stat-value">{{ formatSalary(data.summary.maxSalary) }}</div>
            <div class="stat-label">最高薪资</div>
          </div>
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
          <button :class="{ active: activeDim === 'experience' }" @click="switchRegionDim('experience')">经验年限</button>
          <button :class="{ active: activeDim === 'skills' }" @click="switchRegionDim('skills')">技能词云</button>
        </div>

        <div class="chart-row">
          <div class="chart-panel map-panel">
            <h3>黑龙江省{{ regionStats.dimensions.find(d => d.key === activeDim)?.label || '区域分布' }}</h3>
            <div ref="mapDom" class="chart-box"></div>
          </div>
          <div class="chart-panel bar-panel">
            <h3>
              <template v-if="activeDim === 'experience'">经验年限</template>
              <template v-else-if="activeDim === 'skills'">技能词云</template>
              <template v-else>{{ regionStats.dimensions.find(d => d.key === activeDim)?.label }}明细</template>
            </h3>
            <div ref="barDom" class="chart-box"></div>
          </div>
        </div>
      </template>

      <!-- ==================== AI 全量洞察 ==================== -->
      <div class="section-divider"><span>AI 全量洞察报告</span></div>

      <div class="insights-toolbar">
        <div class="insights-toolbar-left">
          <el-select
            v-if="insightsHistory.length > 0"
            :model-value="currentInsight?.id"
            size="small"
            @change="viewReport"
            placeholder="选择历史报告"
            style="width: 320px;"
          >
            <el-option
              v-for="r in insightsHistory"
              :key="r.id"
              :label="`${r.title} (${new Date(r.createdAt).toLocaleDateString('zh-CN')})`"
              :value="r.id"
            />
          </el-select>
          <span v-if="currentInsight" class="insights-model-tag">
            <el-tag size="small" type="warning">{{ currentInsight.modelUsed }}</el-tag>
          </span>
        </div>
        <div class="insights-toolbar-right">
          <el-button
            v-if="currentInsight"
            type="success"
            size="small"
            :icon="Download"
            @click="downloadPdf(currentInsight.id)"
          >下载 PDF</el-button>
          <el-button
            type="primary"
            size="small"
            :loading="generatingInsight"
            :icon="generatingInsight ? Loading : MagicStick"
            @click="generateInsight"
          >{{ generatingInsight ? '正在生成...' : '生成洞察报告' }}</el-button>
        </div>
      </div>

      <!-- 报告生成中 -->
      <div v-if="generatingInsight" class="insights-generating">
        <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        <span>正在分析全量招聘数据，AI 生成洞察报告中，预计需要 30-60 秒...</span>
      </div>

      <!-- 报告内容 -->
      <div v-if="currentInsight && !generatingInsight" class="insights-report">
        <div v-if="currentInsight.summary" class="insights-summary">
          <h3>摘要</h3>
          <p>{{ currentInsight.summary }}</p>
        </div>

        <div v-if="currentInsight.content" class="insights-body">
          <div v-for="(section, idx) in parseContent(currentInsight.content)" :key="idx" class="insight-section">
            <h3 v-if="section.heading" class="insight-heading" v-html="renderMarkdown(section.heading)"></h3>
            <div class="insight-body" v-html="renderMarkdown(section.body)"></div>
            <div v-if="section.key_insight" class="insight-key-finding">
              <strong>关键发现：</strong>{{ section.key_insight }}
            </div>
          </div>
        </div>

        <div v-if="currentInsight.createdAt" class="insights-footer">
          报告生成时间：{{ new Date(currentInsight.createdAt).toLocaleString('zh-CN') }}
        </div>
      </div>

      <!-- 空状态：没有报告也没有在生成 -->
      <div v-if="!currentInsight && !generatingInsight" class="insights-empty">
        <p>暂无洞察报告，点击"生成洞察报告"按钮，AI 将对所有招聘数据进行深度分析</p>
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
  display: flex;
  align-items: center;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-card.accent .stat-value { color: #409eff; }
.stat-card.accent-high .stat-value { color: #f56c6c; }

.stat-text {
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
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

/* ==================== AI 全量洞察 ==================== */
.insights-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.insights-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.insights-toolbar-right {
  display: flex;
  gap: 8px;
}
.insights-model-tag {
  font-size: 12px;
}

.insights-generating {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(102,126,234,0.04), rgba(118,75,162,0.04));
  border-radius: 12px;
  border: 1px solid #ebeef5;
  margin-bottom: 16px;
  color: #606266;
  font-size: 14px;
}

.insights-report {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

.insights-summary {
  background: linear-gradient(135deg, rgba(102,126,234,0.06), rgba(118,75,162,0.06));
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #667eea;
}
.insights-summary h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #667eea;
}
.insights-summary p {
  margin: 0;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.7;
}

.insights-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.insight-section h3.insight-heading {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 8px;
}
.insight-section h3.insight-heading :deep(h2),
.insight-section h3.insight-heading :deep(h3),
.insight-section h3.insight-heading :deep(h4) {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
}

.insight-body {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.8;
}
.insight-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}
.insight-body :deep(th) {
  background: #f5f7fa;
  padding: 8px 12px;
  text-align: left;
  border: 1px solid #ebeef5;
  font-weight: 600;
}
.insight-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid #ebeef5;
}
.insight-body :deep(strong) {
  color: #303133;
}
.insight-body :deep(ul) {
  margin: 8px 0;
  padding-left: 20px;
}
.insight-body :deep(li) {
  margin: 4px 0;
}
.insight-body :deep(code) {
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #e6a23c;
}

.insight-key-finding {
  background: #fdf6ec;
  padding: 10px 16px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 13px;
  color: #e6a23c;
  border-left: 3px solid #e6a23c;
  line-height: 1.7;
}

.insights-footer {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.insights-empty {
  text-align: center;
  padding: 40px;
  color: #909399;
  font-size: 14px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  margin-bottom: 16px;
}
</style>
