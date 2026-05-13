<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserInfo, logout as authLogout } from '@/utils/auth'
import {
  HomeFilled, Monitor, Files, TrendCharts, DataAnalysis, Search,
  Setting, User, UserFilled, Lock, Menu as MenuIcon, Document, InfoFilled,
  PieChart, ChatDotRound, Headset,
} from '@element-plus/icons-vue'
import { getMenuTree, type SystemMenu } from '@/api/system'

const route = useRoute()
const router = useRouter()

const userInfo = ref<any>({
  name: '用户',
  avatar: '',
  userId: '',
  userLoginName: '',
  loginType: 'oauth2'
})

const isCollapse = ref(false)

const isSubPage = computed(() => {
  return route.path.startsWith('/crawler/') && route.path !== '/crawler'
})

const isFullScreen = computed(() => route.path === '/daping')

interface MenuItem {
  path?: string; title: string; icon: any; children?: { path: string; title: string; icon?: any }[]
}

// 图标名称 → 组件映射（markRaw 避免 Vue 深度响应式包装）
const namedIcons: Record<string, any> = {
  HomeFilled: markRaw(HomeFilled), Monitor: markRaw(Monitor), Files: markRaw(Files),
  TrendCharts: markRaw(TrendCharts), DataAnalysis: markRaw(DataAnalysis), Search: markRaw(Search),
  Setting: markRaw(Setting), User: markRaw(User), UserFilled: markRaw(UserFilled),
  Lock: markRaw(Lock), Menu: markRaw(MenuIcon), Document: markRaw(Document), InfoFilled: markRaw(InfoFilled),
  PieChart: markRaw(PieChart), ChatDotRound: markRaw(ChatDotRound), Headset: markRaw(Headset),
}

// 默认菜单（API 故障时的兜底）
const defaultMenuItems: MenuItem[] = [
  { path: '/home', title: '首页', icon: namedIcons.HomeFilled },
  { path: '/crawler', title: '数据采集', icon: namedIcons.Monitor },
  { path: '/files', title: '数据管理', icon: namedIcons.Files },
  { path: '/analysis', title: '智能分析', icon: namedIcons.PieChart },
  { path: '/dashboard', title: '数据看板', icon: namedIcons.DataAnalysis },
  { path: '/daping', title: '数据大屏', icon: namedIcons.Monitor },
  { path: '/query', title: '智能查询', icon: namedIcons.ChatDotRound },
  {
    title: '语义搜索', icon: namedIcons.Search,
    children: [
      { path: '/rag', title: '职位搜索', icon: namedIcons.Search },
      { path: '/rag/resume', title: '简历筛选', icon: namedIcons.User },
    ]
  },
  {
    title: '系统管理', icon: namedIcons.Setting,
    children: [
      { path: '/system/users', title: '用户管理', icon: namedIcons.User },
      { path: '/system/roles', title: '角色管理', icon: namedIcons.UserFilled },
      { path: '/system/permissions', title: '权限管理', icon: namedIcons.Lock },
      { path: '/system/menus', title: '菜单管理', icon: namedIcons.Menu },
      { path: '/system/enrichment', title: '增强数据管理', icon: namedIcons.DataAnalysis },
      { path: '/system/vectors', title: '文本向量管理', icon: namedIcons.Search },
      { path: '/system/training', title: '模型训练', icon: namedIcons.TrendCharts },
      { path: '/settings/llm', title: '模型配置', icon: namedIcons.Setting },
    ]
  },
  {
    title: '系统帮助', icon: namedIcons.Headset,
    children: [
      { path: '/docs', title: '帮助文档', icon: namedIcons.Document },
      { path: '/aibot', title: '问答机器人', icon: namedIcons.ChatDotRound },
    ]
  },
  { path: '/about', title: '关于', icon: namedIcons.InfoFilled }
]

const menuItems = shallowRef<MenuItem[]>(defaultMenuItems)

// 将 API 返回的菜单树转换为侧边栏格式
function buildMenuItems(menus: SystemMenu[]): MenuItem[] {
  return menus
    .filter(m => !m.hidden)
    .map(m => {
      const icon = namedIcons[m.icon || ''] || namedIcons.Menu
      if (m.children && m.children.length > 0) {
        return {
          title: m.name,
          icon,
          children: buildMenuItems(m.children).map(c => ({
            path: c.path,
            title: c.title,
            icon: c.icon,
          })),
        }
      }
      return {
        path: m.path || '/',
        title: m.name,
        icon,
      }
    })
}

onMounted(async () => {
  try {
    const res = await getMenuTree()
    // 注意：axios 响应拦截器已解包 response.data，res 即 { success, data }
    if (res?.success && res.data?.length > 0) {
      menuItems.value = buildMenuItems(res.data)
    }
  } catch (e) {
    console.error('[MainLayout] 获取菜单树失败，使用默认菜单', e)
  }
})

const activeMenu = computed(() => {
  const currentPath = route.path
  if (currentPath.startsWith('/crawler/')) return '/crawler'
  if (currentPath.startsWith('/system/')) return currentPath
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
  }
}

// 🔧 处理登出
const handleLogout = () => {
  console.log('[MainLayout] 用户登出, 登录类型:', userInfo.value.loginType);
  
  // 如果是本地登录,清除 localStorage
  if (userInfo.value.loginType === 'local') {
    localStorage.removeItem('user_info');
    localStorage.removeItem('is_authenticated');
    console.log('[MainLayout] 已清除本地登录信息');
    
    // 跳转到登录页
    window.location.href = '/login';
    return;
  }
  
  // OAuth2 登录,调用 auth 服务的登出
  authLogout();
}

// 🔧 加载用户信息
onMounted(() => {
  // 优先检查本地登录的用户信息
  const localUserInfo = localStorage.getItem('user_info');
  const isAuthenticated = localStorage.getItem('is_authenticated');
  
  if (localUserInfo && isAuthenticated === 'true') {
    // 本地登录
    try {
      const info = JSON.parse(localUserInfo);
      userInfo.value = {
        name: info.name || '用户',
        avatar: '',
        userId: info.username,
        userLoginName: info.username,
        loginType: 'local'
      };
      console.log('[MainLayout] 本地登录用户信息已加载:', userInfo.value);
      return;
    } catch (e) {
      console.error('[MainLayout] 解析本地用户信息失败:', e);
    }
  }
  
  // OAuth2 登录
  const info = getUserInfo();
  if (info) {
    userInfo.value = {
      name: info.cnName || info.userLoginName || '用户',
      avatar: info.userProfilePhoto || '',
      userId: info.userId,
      userLoginName: info.userLoginName,
      loginType: 'oauth2'
    };
    console.log('[MainLayout] OAuth2 用户信息已加载:', userInfo.value);
  }
})

// 获取当前页面标题
const getCurrentPageTitle = () => {
  const currentItem = menuItems.value.find(item => item.path === route.path || route.path.startsWith(item.path + '/'))
  return currentItem?.title || ''
}
</script>

<template>
  <a href="#main-content" class="sr-only">跳到主内容</a>
  <el-container class="layout-container">
    <!-- 左侧菜单 - 美化版 -->
    <el-aside v-show="!isFullScreen" :width="isCollapse ? '70px' : '240px'" class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 48 48" class="logo-svg" xmlns="http://www.w3.org/2000/svg">
            <!-- 外环 -->
            <circle cx="24" cy="24" r="22" fill="none" stroke="#C4152D" stroke-width="2.5"/>
            <!-- 天安门简化 -->
            <rect x="16" y="26" width="16" height="5" fill="#C4152D" rx="1"/>
            <rect x="12" y="20" width="5" height="10" fill="#C4152D" rx="1"/>
            <rect x="31" y="20" width="5" height="10" fill="#C4152D" rx="1"/>
            <rect x="19" y="18" width="10" height="5" fill="#C4152D" rx="1"/>
            <!-- 五角星 -->
            <polygon points="24,7 26.5,14.5 34,14.5 28,19 30.5,26.5 24,22 17.5,26.5 20,19 14,14.5 21.5,14.5" fill="#FFD700"/>
            <!-- 底部绶带 -->
            <rect x="10" y="31" width="28" height="4" fill="#C4152D" rx="2"/>
            <rect x="14" y="35" width="20" height="3" fill="#C4152D" rx="1.5"/>
          </svg>
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
          <template v-for="item in menuItems" :key="item.title">
            <el-sub-menu v-if="item.children" :index="item.title" class="sub-menu-custom">
              <template #title>
                <div class="menu-item-content">
                  <el-icon class="menu-icon"><component :is="item.icon" /></el-icon>
                  <transition name="fade-slide">
                    <span v-show="!isCollapse">{{ item.title }}</span>
                  </transition>
                </div>
              </template>
              <el-menu-item
                v-for="child in item.children"
                :key="child.path"
                :index="child.path"
                class="menu-item-custom sub-item"
              >
                <div class="sub-item-content">
                  <el-icon v-if="child.icon" class="sub-icon"><component :is="child.icon" /></el-icon>
                  <span>{{ child.title }}</span>
                </div>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item
              v-else
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
          </template>
        </el-menu>
      </div>
    </el-aside>

    <!-- 右侧主内容区 -->
    <el-container class="main-container">
      <!-- 顶栏 - 美化版（大屏模式下隐藏） -->
      <el-header v-show="!isFullScreen" class="header">
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
              <template v-if="isSubPage">
                <el-breadcrumb-item :to="{ path: '/crawler' }">数据采集</el-breadcrumb-item>
                <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
              </template>
              <el-breadcrumb-item v-else-if="route.path !== '/home'">
                {{ getCurrentPageTitle() }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
        </div>

        <div class="header-right">
          <!-- 数据大屏快捷入口 -->
          <el-button
            class="daping-btn"
            :type="route.path === '/daping' ? 'primary' : 'default'"
            :icon="Monitor"
            size="default"
            round
            @click="router.push('/daping')"
          >
            可视化大屏
          </el-button>
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="36" :src="userInfo.avatar" class="user-avatar">
                <el-icon :size="20"><User /></el-icon>
              </el-avatar>
              <div class="user-details">
                <span class="user-name">{{ userInfo.name }}</span>
                <span class="user-role">{{ userInfo.userLoginName || '用户' }}</span>
              </div>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu class="custom-dropdown">
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容（大屏模式下无 padding/overflow） -->
      <el-main id="main-content" :class="['main', { 'main--fullscreen': isFullScreen }]">
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

/* ===== 左侧边栏 — 玻璃质感 ===== */
.sidebar {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--glass-blur-strong));
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  border-right: 1px solid var(--glass-border);
  position: relative;
}

/* 侧边栏顶部微弱渐变叠加层 */
.sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.03) 0%, transparent 40%, rgba(118, 75, 162, 0.03) 100%);
  pointer-events: none;
  z-index: 0;
}

/* Logo区域 */
.logo {
  height: 70px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: transparent;
  border-bottom: 1px solid var(--glass-border-subtle);
  gap: 12px;
  position: relative;
  z-index: 1;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(196, 21, 45, 0.2);
  transition: transform 0.3s ease;
}

.logo:hover .logo-icon {
  transform: scale(1.08);
}

.logo-svg {
  width: 36px;
  height: 36px;
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
  background: transparent;
  position: relative;
  z-index: 1;
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
  background: var(--glass-bg-hover) !important;
  border-color: rgba(102, 126, 234, 0.15);
  box-shadow: var(--shadow-xs);
}

:deep(.menu-item-custom.is-active) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%) !important;
  border-color: rgba(102, 126, 234, 0.25);
  box-shadow: 0 2px 12px rgba(102, 126, 234, 0.1), inset 0 1px 0 rgba(255,255,255,0.5);
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

/* 子菜单样式 */
:deep(.sub-menu-custom) {
  margin: 2px 12px;
}

:deep(.sub-menu-custom .el-sub-menu__title) {
  height: 48px;
  line-height: 48px;
  border-radius: 8px;
  padding: 0 16px !important;
  color: #4b5563;
  font-weight: 500;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

:deep(.sub-menu-custom .el-sub-menu__title:hover) {
  background: var(--glass-bg-hover) !important;
  border-color: rgba(102, 126, 234, 0.15);
  box-shadow: var(--shadow-xs);
}

:deep(.sub-menu-custom.is-opened .el-sub-menu__title) {
  color: #667eea;
  font-weight: 600;
}

:deep(.sub-menu-custom .el-menu) {
  background: transparent !important;
  padding: 0;
}

:deep(.sub-item) {
  height: 40px;
  line-height: 40px;
  margin: 2px 12px;
  padding: 0 16px !important;
  font-size: 13px;
  color: #6b7280;
  border-radius: 6px;
  transition: all 0.3s ease;
}

:deep(.sub-item:hover) {
  background: var(--glass-bg-hover) !important;
  color: #667eea;
}

:deep(.sub-item.is-active) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%) !important;
  color: #667eea;
  font-weight: 600;
}

.sub-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: #9ca3af;
}

:deep(.sub-item.is-active) .sub-icon {
  color: #667eea;
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
  background: var(--color-bg-page-gradient);
  position: relative;
}

.main-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 30% 20%, rgba(102, 126, 234, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(118, 75, 162, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* ===== 顶部导航栏 - 玻璃质感 ===== */
.header {
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 70px;
  border-bottom: 1px solid var(--glass-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

/* 折叠按钮 */
.collapse-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-subtle);
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.collapse-btn:hover {
  background: var(--glass-bg-hover);
  border-color: rgba(102, 126, 234, 0.25);
  color: #667eea;
  transform: scale(1.05);
  box-shadow: var(--shadow-xs);
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
  gap: 16px;
  position: relative;
  z-index: 1;
}

/* 数据大屏快捷按钮 */
.daping-btn {
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: all var(--transition-base);
  border: none;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.daping-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
}

.daping-btn.el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

/* 用户信息区域 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 12px;
  transition: all var(--transition-base);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-subtle);
}

.user-info:hover {
  background: var(--glass-bg-hover);
  border-color: rgba(102, 126, 234, 0.15);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
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
  background: transparent;
  position: relative;
  z-index: 1;
}

/* 大屏全屏模式：去除 padding 和 overflow */
.main--fullscreen {
  padding: 0;
  overflow: hidden;
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
