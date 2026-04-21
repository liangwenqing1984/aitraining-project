<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserInfo, logout as authLogout } from '@/utils/auth'
import {
  HomeFilled,
  InfoFilled,
  Monitor,
  Folder,
  DataAnalysis,
  Document,
  Setting,
  Fold,
  Expand,
  ArrowDown,
  User,
  SwitchButton,
  TrendCharts,
  Files,
  Operation
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

// 🔧 从Auth服务获取的用户信息
const userInfo = ref<any>({
  name: '用户',
  avatar: '',
  userId: '',
  userLoginName: ''
})

const isCollapse = ref(false)

const menuItems = [
  { path: '/crawler', title: '数据采集', icon: Monitor },
  { path: '/files', title: '数据管理', icon: Files },
  { path: '/analysis', title: '智能分析', icon: TrendCharts },
  { path: '/home', title: '首页', icon: HomeFilled },
  { path: '/about', title: '关于', icon: InfoFilled },
  { path: '/docs', title: '文档', icon: Document },
  { path: '/settings', title: '设置', icon: Setting }
]

const activeMenu = computed(() => {
  // 确保返回正确的激活菜单项
  const currentPath = route.path
  // 对于子路由，返回父路由路径
  if (currentPath.startsWith('/crawler/')) {
    return '/crawler'
  }
  return currentPath
})

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}

// 处理菜单点击
const handleMenuSelect = (path: string) => {
  console.log('[MainLayout] 菜单点击:', path)
  console.log('[MainLayout] 当前路由:', route.path)
  
  // 如果已经在该页面，不重复跳转
  if (route.path === path || (path === '/crawler' && route.path.startsWith('/crawler'))) {
    console.log('[MainLayout] 已在当前页面，无需跳转')
    return
  }
  
  router.push(path).catch(err => {
    console.error('[MainLayout] 路由跳转失败:', err)
  })
}

const handleCommand = (command: string) => {
  if (command === 'logout') {
    handleLogout()
  } else if (command === 'profile') {
    // 跳转到个人中心
  }
}

// 🔧 处理登出
const handleLogout = () => {
  console.log('[MainLayout] 用户登出')
  authLogout()
}

// 🔧 加载用户信息
onMounted(() => {
  const info = getUserInfo()
  if (info) {
    userInfo.value = {
      name: info.cnName || info.userLoginName || '用户',
      avatar: info.userProfilePhoto || '',
      userId: info.userId,
      userLoginName: info.userLoginName
    }
    console.log('[MainLayout] 用户信息已加载:', userInfo.value)
  }
})

// 获取当前页面标题
const getCurrentPageTitle = () => {
  const currentItem = menuItems.find(item => item.path === route.path || route.path.startsWith(item.path + '/'))
  return currentItem?.title || ''
}
</script>

<template>
  <el-container class="layout-container">
    <!-- 左侧菜单 - 美化版 -->
    <el-aside :width="isCollapse ? '70px' : '240px'" class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <img src="@/assets/vue.svg" alt="Logo" class="logo-img" />
        </div>
        <transition name="fade-slide">
          <span v-show="!isCollapse" class="logo-text">高质量人才数据集</span>
        </transition>
      </div>
      
      <div class="menu-wrapper">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :collapse-transition="false"
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item 
            v-for="item in menuItems" 
            :key="item.path" 
            :index="item.path"
            class="menu-item-custom"
          >
            <div class="menu-item-content">
              <el-icon class="menu-icon"><component :is="item.icon" /></el-icon>
              <transition name="fade-slide">
                <span v-show="!isCollapse" class="menu-title">{{ item.title }}</span>
              </transition>
            </div>
          </el-menu-item>
        </el-menu>
      </div>
    </el-aside>

    <!-- 右侧主内容区 -->
    <el-container class="main-container">
      <!-- 顶栏 - 美化版 -->
      <el-header class="header">
        <div class="header-left">
          <el-button
            class="collapse-btn"
            :icon="isCollapse ? Expand : Fold"
            circle
            text
            @click="toggleSidebar"
          />
          <div class="breadcrumb-area">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="route.path !== '/home'">
                {{ getCurrentPageTitle() }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
        </div>

        <div class="header-right">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="36" :src="userInfo.avatar" class="user-avatar">
                {{ userInfo.name?.charAt(0) }}
              </el-avatar>
              <div class="user-details">
                <span class="user-name">{{ userInfo.name }}</span>
                <span class="user-role">{{ userInfo.userLoginName || '用户' }}</span>
              </div>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="custom-dropdown">
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Operation /></el-icon>系统设置
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容 -->
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
}

/* ===== 左侧边栏 - 浅色柔和主题 ===== */
.sidebar {
  background: #ffffff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
  border-right: 1px solid #e8eaed;
  position: relative;
  z-index: 10;
}

/* Logo区域 */
.logo {
  height: 70px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e8eaed;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
  transition: transform 0.3s ease;
}

.logo:hover .logo-icon {
  transform: rotate(5deg) scale(1.05);
}

.logo-img {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1);
}

.logo-text {
  color: #1e293b;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

/* 菜单容器 */
.menu-wrapper {
  height: calc(100vh - 70px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 0;
  background: #fafbfc;
}

.menu-wrapper::-webkit-scrollbar {
  width: 4px;
}

.menu-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.menu-wrapper::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}

.menu-wrapper::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 侧边栏菜单 */
.sidebar-menu {
  border-right: none;
  background: transparent;
}

/* 自定义菜单项 */
:deep(.menu-item-custom) {
  margin: 4px 12px;
  border-radius: 8px;
  height: 48px;
  line-height: 48px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

:deep(.menu-item-custom .el-menu-item) {
  background: transparent !important;
  color: #4b5563;
  font-weight: 500;
  padding: 0 16px !important;
}

:deep(.menu-item-custom:hover) {
  background: #ffffff !important;
  border-color: #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

:deep(.menu-item-custom.is-active) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%) !important;
  border-color: rgba(102, 126, 234, 0.2);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

:deep(.menu-item-custom.is-active .el-menu-item) {
  color: #667eea !important;
  font-weight: 600;
}

/* 菜单项内容布局 */
.menu-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.menu-icon {
  font-size: 20px;
  flex-shrink: 0;
  transition: all 0.3s ease;
  color: #6b7280;
}

:deep(.menu-item-custom:hover) .menu-icon {
  transform: scale(1.1);
  color: #667eea;
}

:deep(.menu-item-custom.is-active) .menu-icon {
  color: #667eea;
}

.menu-title {
  font-size: 14px;
  white-space: nowrap;
  flex: 1;
}

/* 折叠状态优化 */
.sidebar-menu.el-menu--collapse {
  width: 70px;
}

:deep(.sidebar-menu.el-menu--collapse .menu-item-custom) {
  margin: 4px 8px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 右侧主容器 ===== */
.main-container {
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

/* ===== 顶部导航栏 - 简洁现代风格 ===== */
.header {
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 70px;
  border-bottom: 1px solid #e8eaed;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 折叠按钮 */
.collapse-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f5f7fa;
  border: 1px solid #e8eaed;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.collapse-btn:hover {
  background: #667eea;
  border-color: #667eea;
  color: #fff;
  transform: scale(1.05);
}

/* 面包屑区域 */
.breadcrumb-area {
  padding-left: 8px;
}

:deep(.el-breadcrumb__item) {
  font-size: 14px;
}

:deep(.el-breadcrumb__inner a),
:deep(.el-breadcrumb__inner.is-link) {
  color: #6b7280;
  font-weight: 500;
  transition: color 0.3s ease;
}

:deep(.el-breadcrumb__inner a:hover),
:deep(.el-breadcrumb__inner.is-link:hover) {
  color: #667eea;
}

:deep(.el-breadcrumb__separator) {
  color: #d1d5db;
}

:deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: #1f2937;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
}

/* 用户信息区域 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 10px;
  transition: all 0.3s ease;
  background: #f9fafb;
  border: 1px solid transparent;
}

.user-info:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.user-avatar {
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 600;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
}

.user-role {
  font-size: 12px;
  color: #6b7280;
  line-height: 1;
}

.dropdown-icon {
  font-size: 14px;
  color: #9ca3af;
  transition: transform 0.3s ease;
}

.user-info:hover .dropdown-icon {
  transform: rotate(180deg);
  color: #667eea;
}

/* 自定义下拉菜单 */
:deep(.custom-dropdown) {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  padding: 4px;
}

:deep(.custom-dropdown .el-dropdown-menu__item) {
  border-radius: 6px;
  padding: 10px 16px;
  margin: 2px 0;
  transition: all 0.2s ease;
}

:deep(.custom-dropdown .el-dropdown-menu__item:hover) {
  background: #f3f4f6;
  color: #667eea;
}

:deep(.custom-dropdown .el-dropdown-menu__item .el-icon) {
  margin-right: 8px;
  font-size: 16px;
}

/* 主内容区 */
.main {
  padding: 24px;
  overflow-y: auto;
  background: #f5f7fa;
}

/* ===== 过渡动画 ===== */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
