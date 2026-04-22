import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isAuthenticated } from '@/utils/auth'

const routes: RouteRecordRaw[] = [
  // 登录页面（不需要认证）
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  
  // OAuth2回调页面（不需要认证）
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('@/views/AuthCallback.vue'),
    meta: { title: '登录回调', requiresAuth: false }
  },
  
  // 后端API路径占位路由（防止Vue Router报"No match found"警告）
  // 这些路径会被Vite代理转发到后端，不会真正渲染组件
  {
    path: '/api/:pathMatch(.*)*',
    name: 'ApiPlaceholder',
    component: { template: '<div></div>' },  // 空组件，仅用于占位
    meta: { requiresAuth: false }
  },
  
  // 主应用路由（需要认证）
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/crawler',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'crawler',
        name: 'Crawler',
        component: () => import('@/views/crawler/Index.vue'),
        meta: { title: '爬虫管理', icon: 'Monitor' }
      },
      {
        path: 'crawler/create',
        name: 'CreateTask',
        component: () => import('@/views/crawler/CreateTask.vue'),
        meta: { title: '创建任务' }
      },
      {
        path: 'crawler/batch-create',
        name: 'BatchTaskCreator',
        component: () => import('@/views/crawler/BatchTaskCreator.vue'),
        meta: { title: '批量创建任务' }
      },
      {
        path: 'crawler/monitor/:id',
        name: 'TaskMonitor',
        component: () => import('@/views/crawler/TaskMonitor.vue'),
        meta: { title: '任务监控' }
      },
      {
        path: 'crawler/edit/:id',
        name: 'EditTask',
        component: () => import('@/views/crawler/EditTask.vue'),
        meta: { title: '配置任务' }
      },
      {
        path: 'files',
        name: 'Files',
        component: () => import('@/views/files/Index.vue'),
        meta: { title: '文件管理', icon: 'Folder' }
      },
      {
        path: 'analysis',
        name: 'Analysis',
        component: () => import('@/views/analysis/Index.vue'),
        meta: { title: '数据分析', icon: 'DataAnalysis' }
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页', icon: 'HomeFilled' }
      },
      {
        path: 'about',
        name: 'About',
        component: () => import('@/views/About.vue'),
        meta: { title: '关于', icon: 'InfoFilled' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：检查认证状态
router.beforeEach((to, from, next) => {
  // 排除后端API路径（/api/*），这些路径应该由后端直接处理
  if (to.path.startsWith('/api/')) {
    console.log('[Router] 检测到API路径，放行由后端处理:', to.path);
    next();
    return;
  }
  
  const requiresAuth = to.meta.requiresAuth !== false; // 默认需要认证
  
  if (requiresAuth && !isAuthenticated()) {
    // 未登录，跳转到登录页
    console.log('[Router] 未登录，跳转到登录页');
    next({
      path: '/login',
      query: { redirect: to.fullPath } // 保存原目标路径
    });
  } else if (to.path === '/login' && isAuthenticated()) {
    // 已登录用户访问登录页，跳转到首页
    console.log('[Router] 已登录，跳转到首页');
    next('/');
  } else {
    next();
  }
});

export default router
