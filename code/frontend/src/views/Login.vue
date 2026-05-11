<template>
  <div class="login-page">
    <!-- 首页仪表盘背景板 -->
    <div class="dashboard-bg">
      <div class="dashboard-content">
        <!-- 核心亮点卡片区 -->
        <div class="mock-section">
          <div class="mock-section-title">系统核心亮点</div>
          <div class="mock-section-subtitle">一站式招聘数据采集、增强、分析与智能检索平台</div>
          <div class="mock-cards">
            <div class="mock-card" v-for="card in mockCards" :key="card.title">
              <div class="mock-card-icon" :style="{ background: card.bg, color: card.color }">
                <el-icon :size="18"><component :is="card.icon" /></el-icon>
              </div>
              <div class="mock-card-body">
                <div class="mock-card-title">{{ card.title }}</div>
                <div class="mock-card-desc">{{ card.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作流程区 -->
        <div class="mock-section">
          <div class="mock-section-title">操作流程指引</div>
          <div class="mock-flow">
            <div class="mock-step" v-for="(step, i) in mockSteps" :key="step">
              <div class="mock-step-num">{{ i + 1 }}</div>
              <div class="mock-step-text">{{ step }}</div>
              <div v-if="i < mockSteps.length - 1" class="mock-step-arrow">→</div>
            </div>
          </div>
          <div class="mock-buttons">
            <span class="mock-btn-label">快速开始：</span>
            <span class="mock-btn primary">任务列表</span>
            <span class="mock-btn success">文件管理</span>
            <span class="mock-btn warning">智能分析</span>
            <span class="mock-btn danger">智能查询</span>
            <span class="mock-btn purple">语义搜索</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 渐变遮罩 -->
    <div class="bg-overlay"></div>

    <!-- 登录卡片 -->
    <div class="login-card-wrapper">
      <div class="login-card">
        <!-- 品牌区 -->
        <div class="card-brand">
          <div class="card-logo">
            <svg viewBox="0 0 48 48" class="logo-svg" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" fill="none" stroke="#667eea" stroke-width="2" opacity="0.6"/>
              <rect x="16" y="26" width="16" height="5" fill="#667eea" rx="1" opacity="0.9"/>
              <rect x="12" y="20" width="5" height="10" fill="#667eea" rx="1" opacity="0.9"/>
              <rect x="31" y="20" width="5" height="10" fill="#667eea" rx="1" opacity="0.9"/>
              <rect x="19" y="18" width="10" height="5" fill="#667eea" rx="1" opacity="0.9"/>
              <polygon points="24,7 26.5,14.5 34,14.5 28,19 30.5,26.5 24,22 17.5,26.5 20,19 14,14.5 21.5,14.5" fill="#FFD700"/>
              <rect x="10" y="31" width="28" height="4" fill="#667eea" rx="2" opacity="0.9"/>
              <rect x="14" y="35" width="20" height="3" fill="#667eea" rx="1.5" opacity="0.9"/>
            </svg>
          </div>
          <h1 class="card-title">高质量人才数据集</h1>
          <p class="card-subtitle">AI 驱动的智能招聘数据采集与分析平台</p>
        </div>

        <!-- 错误信息 -->
        <transition name="fade-slide">
          <el-alert
            v-if="errorMessage"
            :title="errorMessage"
            type="error"
            :closable="true"
            show-icon
            @close="errorMessage = ''"
            class="error-alert"
          />
        </transition>

        <!-- 登录 Tabs -->
        <el-tabs v-model="activeTab" class="login-tabs">
          <el-tab-pane label="账号登录" name="local">
            <el-form
              ref="loginFormRef"
              :model="loginForm"
              :rules="loginRules"
              class="login-form"
              @keyup.enter="handleLocalLogin"
            >
              <el-form-item prop="username">
                <el-input
                  v-model="loginForm.username"
                  placeholder="用户名"
                  size="large"
                  :prefix-icon="User"
                  clearable
                />
              </el-form-item>
              <el-form-item prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="密码"
                  size="large"
                  :prefix-icon="Lock"
                  show-password
                  clearable
                />
              </el-form-item>
              <el-form-item>
                <div class="form-options">
                  <el-checkbox v-model="rememberMe">记住账号</el-checkbox>
                </div>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="large" class="submit-btn" :loading="localLoading" @click="handleLocalLogin">
                  {{ localLoading ? '验证中...' : '登 录' }}
                </el-button>
              </el-form-item>
              <el-alert type="info" :closable="false" show-icon class="test-alert">
                <template #default>
                  <code>admin / admin123</code>
                </template>
              </el-alert>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="统一认证" name="oauth2">
            <div class="oauth2-login">
              <div class="oauth2-icon-wrap">
                <el-icon :size="36" color="#667eea"><Connection /></el-icon>
              </div>
              <h3>企业统一认证</h3>
              <p>使用公司统一身份认证中心账号登录</p>
              <el-button type="primary" size="large" class="oauth2-btn" :loading="oauth2Loading" @click="handleOAuth2Login">
                <span class="btn-content">
                  <el-icon v-if="!oauth2Loading" :size="18"><Promotion /></el-icon>
                  <span>{{ oauth2Loading ? '跳转中...' : '前往统一认证中心' }}</span>
                </span>
              </el-button>
              <div class="oauth2-tips">
                <div class="tip-item">
                  <el-icon class="tip-icon" :size="14"><CircleCheckFilled /></el-icon>
                  <span>单点登录，一次认证全站通行</span>
                </div>
                <div class="tip-item">
                  <el-icon class="tip-icon" :size="14"><Key /></el-icon>
                  <span>企业级安全加密保护</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="card-footer">
          <span>© 2026 黑龙江人才数据中心</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRoute } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Monitor, Cpu, DataAnalysis, ChatDotRound, Search, Connection,
  User, Lock, Promotion, CircleCheckFilled, Key,
} from '@element-plus/icons-vue'
import { login as oauth2Login } from '@/utils/auth'
import { ElMessage } from 'element-plus'

const route = useRoute()
const activeTab = ref('local')
const localLoading = ref(false)
const oauth2Loading = ref(false)
const errorMessage = ref('')
const rememberMe = ref(false)

// 首页仪表盘模拟数据
const mockCards = [
  { icon: Monitor, color: '#409eff', bg: '#ecf5ff', title: '多源智能爬取', desc: '支持智联招聘、51job 双源采集，IP代理池自动切换' },
  { icon: Cpu, color: '#67c23a', bg: '#f0f9eb', title: 'AI 数据增强', desc: 'LLM 自动标准化薪资、提取技能标签、分类职位' },
  { icon: DataAnalysis, color: '#e6a23c', bg: '#fdf6ec', title: '多维智能分析', desc: '薪资分布/城市热度/技能图谱等 7 维度图表' },
  { icon: ChatDotRound, color: '#f56c6c', bg: '#fef0f0', title: '自然语言查询', desc: '中文提问查询数据，AI 自动生成 SQL' },
  { icon: Search, color: '#9b59b6', bg: '#f5f0ff', title: 'RAG 语义搜索', desc: '职位向量化索引 + 语义相似匹配' },
  { icon: Connection, color: '#00b8ba', bg: '#e8fffe', title: 'IP 代理池', desc: 'HTTP 正向代理，失效自动切换，健康检查保障' },
]

const mockSteps = ['创建爬取任务', '自动采集数据', 'AI 增强数据', '智能分析', '自由查询']

const loginFormRef = ref<FormInstance>()
const loginForm = reactive({ username: '', password: '' })
const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不少于 6 个字符', trigger: 'blur' },
  ],
}

if (route.query.error) {
  const error = route.query.error as string
  const desc = route.query.error_description as string
  const map: Record<string, string> = {
    missing_code: '缺少授权码，请重新登录',
    token_exchange_failed: `Token交换失败：${desc || '请稍后重试'}`,
    unknown_error: `登录失败：${desc || '未知错误'}`,
  }
  errorMessage.value = map[error] || desc || '登录失败，请重试'
  activeTab.value = 'oauth2'
}

async function handleLocalLogin() {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    localLoading.value = true
    errorMessage.value = ''
    try {
      const response = await fetch('/api/auth/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || '登录失败')
      const user = result.data
      localStorage.setItem('user_info', JSON.stringify({
        username: user.username, name: user.name, role: user.role,
        roles: user.roles || [], roleIds: user.roleIds || [],
        email: user.email || '', phone: user.phone || '',
        loginTime: new Date().toISOString(), loginType: 'local',
      }))
      localStorage.setItem('is_authenticated', 'true')
      if (rememberMe.value) localStorage.setItem('remember_username', loginForm.username)
      else localStorage.removeItem('remember_username')
      ElMessage.success(`欢迎回来，${user.name}！`)
      setTimeout(() => { window.location.href = '/' }, 500)
    } catch (error: any) {
      errorMessage.value = error.message || '登录失败，请检查用户名和密码'
    } finally {
      localLoading.value = false
    }
  })
}

function handleOAuth2Login() {
  oauth2Loading.value = true
  errorMessage.value = ''
  try { oauth2Login('/') } catch {
    errorMessage.value = '跳转认证中心失败，请重试'
    oauth2Loading.value = false
  }
}

const rememberedUsername = localStorage.getItem('remember_username')
if (rememberedUsername) { loginForm.username = rememberedUsername; rememberMe.value = true }
</script>

<style scoped>
/* ========================
   全局
   ======================== */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif;
  background: #f0f2f5;
}

/* ========================
   背景：首页仪表盘复现
   ======================== */
.dashboard-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  padding: 60px 300px 60px 240px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.dashboard-content {
  max-width: 960px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-top: 40px;
}

.mock-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.mock-section-subtitle {
  font-size: 12px;
  color: #909399;
  margin-bottom: 14px;
}

.mock-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.mock-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.mock-card-icon {
  width: 38px; height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mock-card-body {
  min-width: 0;
}

.mock-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 3px;
}

.mock-card-desc {
  font-size: 11px;
  color: #909399;
  line-height: 1.5;
}

/* 操作流程 */
.mock-flow {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 20px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  margin-bottom: 14px;
}

.mock-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.mock-step-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.mock-step-text {
  font-size: 12px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
}

.mock-step-arrow {
  font-size: 14px;
  color: #c0c4cc;
  margin: 0 2px;
  flex-shrink: 0;
}

.mock-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 20px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
}

.mock-btn-label {
  font-size: 12px;
  color: #909399;
}

.mock-btn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 500;
  color: #fff;
}

.mock-btn.primary { background: #409eff; }
.mock-btn.success { background: #67c23a; }
.mock-btn.warning { background: #e6a23c; }
.mock-btn.danger { background: #f56c6c; }
.mock-btn.purple { background: #9b59b6; }

/* 渐变遮罩 */
.bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(135deg, rgba(102,126,234,0.55) 0%, rgba(118,75,162,0.55) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ========================
   登录卡片
   ======================== */
.login-card-wrapper {
  position: relative;
  z-index: 2;
  animation: cardIn 0.8s ease-out;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(30px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.login-card {
  width: 680px;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow:
    0 20px 60px rgba(0,0,0,0.15),
    0 0 0 1px rgba(255,255,255,0.5) inset;
  padding: 44px 44px 36px;
}

/* 品牌区 */
.card-brand {
  text-align: center;
  margin-bottom: 28px;
}

.card-logo {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
}

.logo-svg {
  width: 100%; height: 100%;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 6px;
  letter-spacing: 1px;
}

.card-subtitle {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

/* 错误提示 */
.error-alert {
  margin-bottom: 16px;
  border-radius: 10px;
}

/* Tabs */
.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 18px;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 500;
  color: #909399;
  padding: 0 18px;
  height: 38px;
  line-height: 38px;
}

.login-tabs :deep(.el-tabs__item:hover) {
  color: #667eea;
}

.login-tabs :deep(.el-tabs__item.is-active) {
  color: #667eea;
  font-weight: 600;
}

.login-tabs :deep(.el-tabs__active-bar) {
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 1px;
}

/* 表单 */
.login-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.login-form :deep(.el-input__wrapper) {
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #e2e2e2 inset;
  background: #fafbfc;
  transition: all 0.3s;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c4c4c4 inset;
  background: #fff;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(102,126,234,0.35) inset;
  background: #fff;
}

.form-options {
  display: flex;
  align-items: center;
}

.form-options :deep(.el-checkbox__label) {
  font-size: 13px;
  color: #909399;
}

.submit-btn {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 14px rgba(102,126,234,0.35);
  transition: all 0.3s;
  letter-spacing: 4px;
}

.submit-btn:hover {
  box-shadow: 0 6px 20px rgba(102,126,234,0.45);
  transform: translateY(-1px);
}

.test-alert {
  margin-top: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f7ff 0%, #eef0ff 100%);
  border: 1px solid #d4d8f0;
}

.test-alert :deep(.el-alert__description) {
  display: flex;
  justify-content: center;
}

.test-alert code {
  background: rgba(102,126,234,0.08);
  padding: 4px 12px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #667eea;
  font-size: 12px;
  border: 1px solid rgba(102,126,234,0.15);
}

/* OAuth2 */
.oauth2-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.oauth2-icon-wrap {
  margin-bottom: 4px;
}

.oauth2-login h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.oauth2-login p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.oauth2-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 14px rgba(102,126,234,0.35);
}

.oauth2-btn:hover {
  box-shadow: 0 6px 20px rgba(102,126,234,0.45);
  transform: translateY(-1px);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.oauth2-tips {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: #f8f9fc;
  border-radius: 10px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.tip-item .tip-icon {
  color: #52c41a;
  flex-shrink: 0;
}

/* 卡片底部 */
.card-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 12px;
  color: #c0c4cc;
}

/* 动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ========================
   响应式
   ======================== */
@media (max-width: 768px) {
  .dashboard-bg {
    padding: 20px;
  }
  .mock-cards {
    grid-template-columns: 1fr 1fr;
  }
  .mock-flow {
    flex-wrap: wrap;
    gap: 8px;
  }
  .login-card {
    width: 92vw;
    padding: 36px 28px 28px;
  }
}

@media (max-width: 480px) {
  .mock-cards {
    grid-template-columns: 1fr;
  }
  .login-card {
    padding: 28px 22px 22px;
  }
  .card-title {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-card-wrapper { animation: none; }
  .submit-btn:hover { transform: none; }
}
</style>
