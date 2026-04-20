<script setup lang="ts">
import { ref } from 'vue'

const stats = ref([
  { title: '用户总数', value: '1,234', icon: 'User', color: '#409eff' },
  { title: '订单数量', value: '5,678', icon: 'Document', color: '#67c23a' },
  { title: '销售额', value: '¥89,000', icon: 'Money', color: '#e6a23c' },
  { title: '访问量', value: '12,345', icon: 'View', color: '#f56c6c' }
])
</script>

<template>
  <div class="home-page">
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6" v-for="stat in stats" :key="stat.title">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-title">{{ stat.title }}</div>
              <div class="stat-value">{{ stat.value }}</div>
            </div>
            <el-icon :size="48" :color="stat.color">
              <component :is="stat.icon" />
            </el-icon>
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
  margin-bottom: 16px;
}

.stat-card {
  height: 120px;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.content-row {
  margin-top: 16px;
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
}
</style>
