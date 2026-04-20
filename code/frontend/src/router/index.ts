import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/crawler',
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

export default router
