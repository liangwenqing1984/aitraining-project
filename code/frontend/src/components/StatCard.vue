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

const themeColors: Record<string, { accent: string; iconBg: string; iconColor: string; glow: string; valueColor: string }> = {
  primary: {
    accent: '#3b82f6',
    iconBg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    iconColor: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.25)',
    valueColor: '#2563eb'
  },
  success: {
    accent: '#10b981',
    iconBg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    iconColor: '#10b981',
    glow: 'rgba(16, 185, 129, 0.25)',
    valueColor: '#059669'
  },
  warning: {
    accent: '#f59e0b',
    iconBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    iconColor: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.25)',
    valueColor: '#d97706'
  },
  info: {
    accent: '#8b5cf6',
    iconBg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    iconColor: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.25)',
    valueColor: '#7c3aed'
  },
  danger: {
    accent: '#ef4444',
    iconBg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    iconColor: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.25)',
    valueColor: '#dc2626'
  }
}

const colors = themeColors[props.theme] || themeColors.primary
</script>

<template>
  <div class="stat-card" :class="[`stat-card-${theme}`]">
    <div class="stat-icon" :style="{ background: colors.iconBg, color: colors.iconColor, boxShadow: `0 4px 16px ${colors.glow}` }">
      <el-icon :size="24"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-content">
      <div class="stat-value" :style="{ color: colors.valueColor }">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl);
  padding: 22px 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--glass-border-subtle);
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  cursor: default;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: v-bind('colors.accent');
  border-radius: 3px 3px 0 0;
  opacity: 0.4;
  transition: opacity var(--transition-base), height var(--transition-base);
}

.stat-card:hover::before {
  opacity: 1;
  height: 4px;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: rgba(102, 126, 234, 0.12);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  position: relative;
  z-index: 1;
}

.stat-card:hover .stat-icon {
  transform: scale(1.1);
}

.stat-content {
  flex: 1;
  position: relative;
  z-index: 1;
  min-width: 0;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 2px;
  letter-spacing: -0.5px;
  transition: transform var(--transition-base);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
</style>
