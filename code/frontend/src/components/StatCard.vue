<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  value: string | number
  label: string
  icon: Component
  theme?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'primary'
})

const themeColors: Record<string, { iconBg: string; iconColor: string }> = {
  primary: { iconBg: '#ecf5ff', iconColor: '#409eff' },
  success: { iconBg: '#f0f9eb', iconColor: '#67c23a' },
  warning: { iconBg: '#fdf6ec', iconColor: '#e6a23c' },
  info:    { iconBg: '#fef0f0', iconColor: '#f56c6c' },
  danger:  { iconBg: '#e8fffe', iconColor: '#00b8ba' },
}

const colors = themeColors[props.theme] || themeColors.primary
</script>

<template>
  <div class="stat-card">
    <div class="stat-icon" :style="{ background: colors.iconBg, color: colors.iconColor }">
      <el-icon :size="20"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-text">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<style scoped>
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

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
</style>
