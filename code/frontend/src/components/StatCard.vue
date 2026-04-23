<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  value: string | number
  label: string
  icon: Component
  theme?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
  accentColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'primary'
})

const themeColors: Record<string, { accent: string; iconBg: string; iconColor: string; iconBgHover: string }> = {
  primary: {
    accent: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    iconBg: '#eff6ff',
    iconColor: '#3b82f6',
    iconBgHover: '#dbeafe'
  },
  success: {
    accent: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
    iconBg: '#ecfdf5',
    iconColor: '#10b981',
    iconBgHover: '#d1fae5'
  },
  warning: {
    accent: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
    iconBg: '#fffbeb',
    iconColor: '#f59e0b',
    iconBgHover: '#fef3c7'
  },
  info: {
    accent: 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)',
    iconBg: '#f5f3ff',
    iconColor: '#8b5cf6',
    iconBgHover: '#ede9fe'
  },
  danger: {
    accent: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
    iconBg: '#fef2f2',
    iconColor: '#ef4444',
    iconBgHover: '#fee2e2'
  }
}

const colors = themeColors[props.theme] || themeColors.primary
</script>

<template>
  <div class="stat-card" :class="[`stat-card-${theme}`]">
    <div
      class="stat-accent"
      :style="{ background: colors.accent }"
    />
    <div
      class="stat-icon"
      :style="{ background: colors.iconBg, color: colors.iconColor }"
    >
      <el-icon :size="28"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-content">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  cursor: default;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-hover);
}

.stat-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  transition: width var(--transition-base);
}

.stat-card:hover .stat-accent {
  width: 6px;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-base), background var(--transition-base);
}

.stat-card:hover .stat-icon {
  transform: scale(1.05);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  line-height: 1;
  margin-bottom: 6px;
  color: var(--color-text-primary);
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  font-weight: 500;
  letter-spacing: 0.3px;
}
</style>
