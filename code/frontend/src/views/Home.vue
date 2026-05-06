<script setup lang="ts">
import { ref } from 'vue'
import { User, Document, Coin, TrendCharts } from '@element-plus/icons-vue'

const stats = ref([
  { title: '用户总数', value: '1,234', icon: User, color: '#409eff', bg: '#ecf5ff' },
  { title: '订单数量', value: '5,678', icon: Document, color: '#67c23a', bg: '#f0f9eb' },
  { title: '销售额', value: '¥89,000', icon: Coin, color: '#e6a23c', bg: '#fdf6ec' },
  { title: '访问量', value: '12,345', icon: TrendCharts, color: '#f56c6c', bg: '#fef0f0' }
])
</script>

<template>
  <div class="home-page">
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6" v-for="stat in stats" :key="stat.title">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon-box" :style="{ background: stat.bg }">
              <el-icon :size="22" :color="stat.color">
                <component :is="stat.icon" />
              </el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-title">{{ stat.title }}</div>
              <div class="stat-value">{{ stat.value }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="content-row">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <span>数据趋势</span>
          </template>
          <div class="chart-placeholder">
            <el-empty description="图表区域" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" :icon="'Plus'">新建任务</el-button>
            <el-button type="success" :icon="'Upload'">导入数据</el-button>
            <el-button type="warning" :icon="'Download'">导出报表</el-button>
            <el-button type="info" :icon="'Setting'">系统设置</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.home-page {
  padding: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  height: 120px;
  border-radius: var(--radius-xl) !important;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.stat-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-base);
}

.stat-card:hover .stat-icon-box {
  transform: scale(1.08);
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

.content-row {
  margin-top: 20px;
}

.chart-placeholder {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-actions .el-button {
  width: 100%;
  justify-content: flex-start;
  border-radius: var(--radius-md);
  font-weight: 500;
}
</style>
