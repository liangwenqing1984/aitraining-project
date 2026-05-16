<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserInfo, logout as authLogout } from '@/utils/auth'
import {
  HomeFilled, Monitor, Files, TrendCharts, DataAnalysis, Search,
  Setting, User, UserFilled, Lock, Menu as MenuIcon, Document, InfoFilled,
  PieChart, ChatDotRound, Headset, Collection, Briefcase, Edit,
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

const isFullScreen = computed(() => route.path === '/daping')

interface MenuItem {
  path?: string; title: string; icon: any; children?: MenuItem[]
}

interface BreadcrumbItem { title: string; path?: string }

// 图标名称 → 组件映射（markRaw 避免 Vue 深度响应式包装）
const namedIcons: Record<string, any> = {
  HomeFilled: markRaw(HomeFilled), Monitor: markRaw(Monitor), Files: markRaw(Files),
  TrendCharts: markRaw(TrendCharts), DataAnalysis: markRaw(DataAnalysis), Search: markRaw(Search),
  Setting: markRaw(Setting), User: markRaw(User), UserFilled: markRaw(UserFilled),
  Lock: markRaw(Lock), Menu: markRaw(MenuIcon), Document: markRaw(Document), InfoFilled: markRaw(InfoFilled),
  PieChart: markRaw(PieChart), ChatDotRound: markRaw(ChatDotRound), Headset: markRaw(Headset),
  Collection: markRaw(Collection), Briefcase: markRaw(Briefcase), Edit: markRaw(Edit),
}

// 默认菜单（API 故障时的兜底）
const defaultMenuItems: MenuItem[] = [
  { path: '/home', title: '首页', icon: namedIcons.HomeFilled },
  { path: '/crawler', title: '数据采集', icon: namedIcons.Monitor },
  { path: '/dashboard', title: '数据看板', icon: namedIcons.DataAnalysis },
  {
    title: '智能查询', icon: namedIcons.ChatDotRound,
    children: [
      { path: '/query', title: '数据问答', icon: namedIcons.ChatDotRound },
      { path: '/rag', title: '职位搜索', icon: namedIcons.Search },
    ]
  },
  {
    title: '模型管理', icon: namedIcons.TrendCharts,
    children: [
      { path: '/system/training', title: '模型训练', icon: namedIcons.TrendCharts },
      { path: '/settings/llm', title: '模型配置', icon: namedIcons.Setting },
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
      {
        title: '提示词管理', icon: namedIcons.Edit,
        children: [
          { path: '/system/prompts/enrichment', title: '数据增强', icon: namedIcons.DataAnalysis },
          { path: '/system/prompts/insights', title: '市场洞察', icon: namedIcons.TrendCharts },
          { path: '/system/prompts/query', title: 'NL查询', icon: namedIcons.ChatDotRound },
          { path: '/system/prompts/resume-parse', title: '简历解析', icon: namedIcons.Document },
          { path: '/system/prompts/anti-crawl', title: '反爬检测', icon: namedIcons.Lock },
        ]
      },
    ]
  },
  {
    title: '场景应用', icon: namedIcons.Monitor,
    children: [
      {
        title: 'HR助手', icon: namedIcons.UserFilled,
        children: [
          { path: '/rag/resume', title: '简历筛选', icon: namedIcons.User },
          { path: '/rag/resume-library', title: '简历库', icon: namedIcons.Collection },
          { path: '/system/internal-jobs', title: '内部岗位', icon: namedIcons.Briefcase },
        ]
      },
    ]
  },
  {
    title: '系统帮助', icon: namedIcons.Headset,
    children: [
      { path: '/docs', title: '帮助文档', icon: namedIcons.Document },
      { path: '/aibot', title: '问答机器人', icon: namedIcons.ChatDotRound },
    ]
  },
]

const menuItems = shallowRef<MenuItem[]>(defaultMenuItems)

// 将 API 返回的菜单树转换为菜单格式
function buildMenuItems(menus: SystemMenu[]): MenuItem[] {
  return menus
    .filter(m => !m.hidden)
    .map(m => {
      const icon = namedIcons[m.icon || ''] || namedIcons.Menu
      if (m.children && m.children.length > 0) {
        return {
          title: m.name,
          icon,
          children: buildMenuItems(m.children),
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

// 处理菜单点击
const handleMenuSelect = (path: string) => {
  if (route.path === path || (path === '/crawler' && route.path.startsWith('/crawler'))) {
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

// 处理登出
const handleLogout = () => {
  if (userInfo.value.loginType === 'local') {
    localStorage.removeItem('user_info');
    localStorage.removeItem('is_authenticated');
    window.location.href = '/login';
    return;
  }
  authLogout();
}

// 加载用户信息
onMounted(() => {
  const localUserInfo = localStorage.getItem('user_info');
  const isAuthenticated = localStorage.getItem('is_authenticated');

  if (localUserInfo && isAuthenticated === 'true') {
    try {
      const info = JSON.parse(localUserInfo);
      userInfo.value = {
        name: info.name || '用户',
        avatar: '',
        userId: info.username,
        userLoginName: info.username,
        loginType: 'local'
      };
      return;
    } catch (e) {
      console.error('[MainLayout] 解析本地用户信息失败:', e);
    }
  }

  const info = getUserInfo();
  if (info) {
    userInfo.value = {
      name: info.cnName || info.userLoginName || '用户',
      avatar: info.userProfilePhoto || '',
      userId: info.userId,
      userLoginName: info.userLoginName,
      loginType: 'oauth2'
    };
  }
})

// 获取面包屑路径（递归搜索，返回从根到当前页的完整层级）
function findBreadcrumbPath(items: MenuItem[], targetPath: string, ancestors: BreadcrumbItem[] = []): BreadcrumbItem[] | null {
  for (const item of items) {
    const current: BreadcrumbItem = { title: item.title, path: item.path }
    if (item.path && (item.path === targetPath || targetPath.startsWith(item.path + '/'))) {
      return [...ancestors, current]
    }
    if (item.children) {
      const found = findBreadcrumbPath(item.children, targetPath, [...ancestors, current])
      if (found) return found
    }
  }
  return null
}
const breadcrumbPath = computed(() => {
  const path = findBreadcrumbPath(menuItems.value, route.path) || []
  // 排除首页（模板中已固定渲染），保留完整菜单层级
  const filtered = path.filter(crumb => crumb.path !== '/home')
  // 如果当前路径比菜单叶子更深（如 /crawler/xxx 子页），追加 route.meta.title
  const last = filtered[filtered.length - 1]
  if (last && last.path !== route.path) {
    const metaTitle = route.meta?.title as string | undefined
    if (metaTitle) filtered.push({ title: metaTitle })
  }
  return filtered
})
</script>

<template>
  <a href="#main-content" class="sr-only">跳到主内容</a>
  <el-container class="layout-container">
    <!-- 顶部导航栏（全屏模式下隐藏） -->
    <el-header v-show="!isFullScreen" class="top-header" height="auto" style="background: #fff; backdrop-filter: none; -webkit-backdrop-filter: none;">
      <!-- 第一行：Logo + 导航菜单 + 右侧操作 -->
      <div class="header-row nav-row">
        <div class="logo-area">
          <div class="logo-icon">
            <svg viewBox="0 0 48 48" class="logo-svg" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#C4152D" stroke-width="2.5"/>
              <rect x="16" y="26" width="16" height="5" fill="#C4152D" rx="1"/>
              <rect x="12" y="20" width="5" height="10" fill="#C4152D" rx="1"/>
              <rect x="31" y="20" width="5" height="10" fill="#C4152D" rx="1"/>
              <rect x="19" y="18" width="10" height="5" fill="#C4152D" rx="1"/>
              <polygon points="24,7 26.5,14.5 34,14.5 28,19 30.5,26.5 24,22 17.5,26.5 20,19 14,14.5 21.5,14.5" fill="#FFD700"/>
              <rect x="10" y="31" width="28" height="4" fill="#C4152D" rx="2"/>
              <rect x="14" y="35" width="20" height="3" fill="#C4152D" rx="1.5"/>
            </svg>
          </div>
          <span class="logo-text">高质量人才数据集</span>
        </div>

        <el-menu
          mode="horizontal"
          :default-active="activeMenu"
          :ellipsis="true"
          class="top-nav-menu"
          style="--el-menu-bg-color: #fff; background: #fff;"
          @select="handleMenuSelect"
        >
          <template v-for="item in menuItems" :key="item.title">
            <el-sub-menu v-if="item.children" :index="item.title">
              <template #title>
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.title }}</span>
              </template>
              <template v-for="child in item.children" :key="child.title">
                <!-- 二级有子菜单 → 嵌套 el-sub-menu（三级菜单） -->
                <el-sub-menu v-if="child.children && child.children.length" :index="child.title">
                  <template #title>
                    <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
                    <span>{{ child.title }}</span>
                  </template>
                  <el-menu-item
                    v-for="sub in child.children"
                    :key="sub.path"
                    :index="sub.path"
                  >
                    <span>{{ sub.title }}</span>
                  </el-menu-item>
                </el-sub-menu>
                <!-- 二级菜单项 -->
                <el-menu-item v-else :index="child.path">
                  <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
                  <span>{{ child.title }}</span>
                </el-menu-item>
              </template>
            </el-sub-menu>
            <el-menu-item v-else :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </el-menu-item>
          </template>
        </el-menu>

        <div class="header-actions">
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
      </div>

      <!-- 第二行：面包屑 -->
      <div class="header-row breadcrumb-row" style="background: #f8f9fa; backdrop-filter: none; -webkit-backdrop-filter: none;">
        <div class="breadcrumb-area">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item
              v-for="(crumb, idx) in breadcrumbPath"
              :key="idx"
              :to="idx < breadcrumbPath.length - 1 && crumb.path ? { path: crumb.path } : undefined"
            >
              {{ crumb.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
      </div>
    </el-header>

    <!-- 主内容区（全屏模式下无 padding/overflow） -->
    <el-main id="main-content" :class="['main', { 'main--fullscreen': isFullScreen }]">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* ===== 顶部 Header ===== */
.top-header {
  --el-header-padding: 0;
  padding: 0;
  height: auto;
  position: sticky;
  top: 0;
  z-index: var(--z-header, 100);
  background: #fff;
  box-shadow: var(--shadow-md);
  border-bottom: 1px solid var(--glass-border);
}

.header-row {
  display: flex;
  align-items: center;
  padding: 0 24px;
}

/* ===== 导航行 ===== */
.nav-row {
  height: var(--nav-bar-height, 60px);
}

/* Logo 区域 */
.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-right: 24px;
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

.logo-area:hover .logo-icon {
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

/* ===== 水平导航菜单 ===== */
.top-nav-menu {
  flex: 1;
  min-width: 0;
  border-bottom: none !important;
  background: #fff;
}

:deep(.top-nav-menu > .el-menu-item),
:deep(.top-nav-menu > .el-sub-menu > .el-sub-menu__title) {
  height: var(--nav-bar-height, 60px);
  line-height: var(--nav-bar-height, 60px);
  border-bottom: 2px solid transparent !important;
  color: #4b5563;
  font-weight: 500;
  transition: all var(--transition-base);
  padding: 0 14px !important;
}

:deep(.top-nav-menu > .el-menu-item:hover),
:deep(.top-nav-menu > .el-sub-menu > .el-sub-menu__title:hover) {
  background: var(--glass-bg-hover) !important;
  color: var(--color-primary) !important;
  border-bottom-color: rgba(102, 126, 234, 0.3) !important;
}

:deep(.top-nav-menu > .el-menu-item.is-active) {
  border-bottom-color: var(--color-primary) !important;
  color: var(--color-primary) !important;
  font-weight: 600;
  background: transparent !important;
}

/* 菜单项自定义图标，不干扰 el-sub-menu 自带的箭头图标 */
:deep(.top-nav-menu > .el-menu-item > .el-icon),
:deep(.top-nav-menu > .el-sub-menu > .el-sub-menu__title > .el-icon:not(.el-sub-menu__icon-arrow)) {
  margin-right: 6px;
  font-size: 18px;
  vertical-align: middle;
}

/* 隐藏子菜单标题右侧的下拉箭头 */
:deep(.top-nav-menu .el-sub-menu__icon-arrow) {
  display: none !important;
}

/* 子菜单弹出框 — 不透明背景 */
:deep(.top-nav-menu .el-menu--popup) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--glass-border);
  padding: 4px;
  background: #fff;
}

:deep(.top-nav-menu .el-menu--popup .el-menu-item) {
  margin: 2px 4px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-size: 13px;
}

:deep(.top-nav-menu .el-menu--popup .el-sub-menu__title) {
  margin: 2px 4px;
  height: 40px;
  line-height: 40px;
  color: #4b5563;
  font-size: 13px;
}

:deep(.top-nav-menu .el-menu--popup .el-menu-item:hover),
:deep(.top-nav-menu .el-menu--popup .el-sub-menu__title:hover) {
  background: var(--glass-bg-hover) !important;
  color: var(--color-primary) !important;
}

:deep(.top-nav-menu .el-menu--popup .el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%) !important;
  color: var(--color-primary) !important;
  font-weight: 600;
}

/* ===== 右侧操作区 ===== */
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-left: 20px;
}

/* ===== 面包屑行 ===== */
.breadcrumb-row {
  height: var(--breadcrumb-bar-height, 42px);
  background: #f8f9fa;
  border-top: 1px solid var(--glass-border-subtle);
}

.breadcrumb-area {
  padding-left: 0;
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  padding: 4px;
}

:deep(.custom-dropdown .el-dropdown-menu__item) {
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
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: var(--color-bg-page-gradient);
  position: relative;
}

.main::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 30% 20%, rgba(102, 126, 234, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(118, 75, 162, 0.03) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.main > :deep(*) {
  position: relative;
  z-index: 1;
}

/* 大屏全屏模式：去除 padding 和 overflow */
.main--fullscreen {
  padding: 0;
  overflow: hidden;
}

/* 无障碍跳过链接 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>

