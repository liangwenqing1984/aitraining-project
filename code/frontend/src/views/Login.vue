<template>
  <div class="login-page">
    <!-- 左侧品牌展示区 -->
    <div class="login-brand">
      <div class="brand-bg-image"></div>
      <div class="brand-overlay"></div>

      <!-- 装饰几何图形 -->
      <div class="brand-decorations">
        <div class="deco-circle deco-1"></div>
        <div class="deco-circle deco-2"></div>
        <div class="deco-circle deco-3"></div>
        <div class="deco-ring deco-4"></div>
      </div>

      <div class="brand-content">
        <div class="brand-header">
          <div class="brand-logo-wrapper">
            <div class="brand-logo-glow"></div>
            <div class="brand-logo">
              <svg viewBox="0 0 48 48" class="logo-svg" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="22" fill="none" stroke="#fff" stroke-width="2" opacity="0.6"/>
                <rect x="16" y="26" width="16" height="5" fill="#fff" rx="1" opacity="0.9"/>
                <rect x="12" y="20" width="5" height="10" fill="#fff" rx="1" opacity="0.9"/>
                <rect x="31" y="20" width="5" height="10" fill="#fff" rx="1" opacity="0.9"/>
                <rect x="19" y="18" width="10" height="5" fill="#fff" rx="1" opacity="0.9"/>
                <polygon points="24,7 26.5,14.5 34,14.5 28,19 30.5,26.5 24,22 17.5,26.5 20,19 14,14.5 21.5,14.5" fill="#FFD700"/>
                <rect x="10" y="31" width="28" height="4" fill="#fff" rx="2" opacity="0.9"/>
                <rect x="14" y="35" width="20" height="3" fill="#fff" rx="1.5" opacity="0.9"/>
              </svg>
            </div>
          </div>
          <h1 class="brand-title">高质量人才数据集</h1>
          <p class="brand-subtitle">AI 驱动的智能招聘数据采集与分析平台</p>
        </div>

        <div class="brand-divider"></div>

        <!-- 核心亮点 -->
        <div class="brand-features">
          <div class="feature-card" v-for="(feat, i) in features" :key="feat.title" :style="{ animationDelay: `${0.2 + i * 0.1}s` }">
            <div class="feature-icon">
              <el-icon :size="22"><component :is="feat.icon" /></el-icon>
            </div>
            <div class="feature-content">
              <h4>{{ feat.title }}</h4>
              <p>{{ feat.desc }}</p>
            </div>
          </div>
        </div>

        <!-- 数据指标 -->
        <div class="brand-stats">
          <div class="stat-item">
            <div class="stat-value">多平台</div>
            <div class="stat-label">数据源覆盖</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-value">AI</div>
            <div class="stat-label">智能驱动</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-value">RBAC</div>
            <div class="stat-label">权限管控</div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        <div class="footer-divider"></div>
        <p>© 2026 黑龙江人才数据中心 · 智能招聘数据平台</p>
      </div>
    </div>

    <!-- 右侧登录表单区 -->
    <div class="login-form-side">
      <div class="form-container">
        <div class="form-header">
          <div class="form-avatar">
            <div class="avatar-circle">
              <el-icon :size="28"><UserFilled /></el-icon>
            </div>
          </div>
          <h2>欢迎回来</h2>
          <p>登录以继续使用系统</p>
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

        <!-- 登录方式 Tabs -->
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
                  placeholder="请输入用户名"
                  size="large"
                  :prefix-icon="User"
                  clearable
                />
              </el-form-item>

              <el-form-item prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
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
                <el-button
                  type="primary"
                  size="large"
                  class="submit-btn"
                  :loading="localLoading"
                  @click="handleLocalLogin"
                >
                  {{ localLoading ? '验证中...' : '登 录' }}
                </el-button>
              </el-form-item>

              <el-alert
                title="测试账号"
                type="info"
                :closable="false"
                show-icon
                class="test-accounts-alert"
              >
                <template #default>
                  <div class="test-accounts">
                    <code>admin / Admin@admin123</code>
                  </div>
                </template>
              </el-alert>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="统一认证" name="oauth2">
            <div class="oauth2-login">
              <div class="oauth2-icon-wrap">
                <div class="oauth2-icon">
                  <el-icon :size="32"><Connection /></el-icon>
                </div>
              </div>
              <h3>企业统一认证</h3>
              <p>使用公司统一身份认证中心账号登录</p>

              <el-button
                type="primary"
                size="large"
                class="oauth2-btn"
                :loading="oauth2Loading"
                @click="handleOAuth2Login"
              >
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import {
  DataAnalysis,
  ChatDotSquare,
  Search,
  Monitor,
  Lock,
  User,
  UserFilled,
  Connection,
  Promotion,
  CircleCheckFilled,
  Key,
} from '@element-plus/icons-vue';
import { login as oauth2Login } from '@/utils/auth';
import { ElMessage } from 'element-plus';

const route = useRoute();
const activeTab = ref('local');
const localLoading = ref(false);
const oauth2Loading = ref(false);
const errorMessage = ref('');
const rememberMe = ref(false);

// 核心亮点
const features = [
  { icon: DataAnalysis, title: 'AI 智能分析', desc: '大模型驱动的职位数据自动解析与多维度可视化洞察' },
  { icon: ChatDotSquare, title: '自然语言查询', desc: '日常语言提问，AI 自动生成 SQL 并返回分析结果' },
  { icon: Search, title: '语义向量搜索', desc: '基于 RAG 架构，精准匹配海量人才数据' },
  { icon: Monitor, title: '多源自动采集', desc: '支持各大招聘平台，智能代理池与反爬对抗' },
  { icon: Lock, title: '企业级权限管控', desc: 'RBAC 权限体系，统一认证与本地登录双重保障' },
];

const loginFormRef = ref<FormInstance>();
const loginForm = reactive({ username: '', password: '' });

const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不少于 6 个字符', trigger: 'blur' },
  ],
};

// OAuth2 回调错误处理
if (route.query.error) {
  const error = route.query.error as string;
  const desc = route.query.error_description as string;
  const map: Record<string, string> = {
    missing_code: '缺少授权码，请重新登录',
    token_exchange_failed: `Token交换失败：${desc || '请稍后重试'}`,
    unknown_error: `登录失败：${desc || '未知错误'}`,
  };
  errorMessage.value = map[error] || desc || '登录失败，请重试';
  activeTab.value = 'oauth2';
}

async function handleLocalLogin() {
  if (!loginFormRef.value) return;
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return;
    localLoading.value = true;
    errorMessage.value = '';
    try {
      const response = await fetch('/api/auth/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || '登录失败');

      const user = result.data;
      const userInfo = {
        username: user.username,
        name: user.name,
        role: user.role,
        roles: user.roles || [],
        roleIds: user.roleIds || [],
        email: user.email || '',
        phone: user.phone || '',
        loginTime: new Date().toISOString(),
        loginType: 'local',
      };
      localStorage.setItem('user_info', JSON.stringify(userInfo));
      localStorage.setItem('is_authenticated', 'true');
      if (rememberMe.value) {
        localStorage.setItem('remember_username', loginForm.username);
      } else {
        localStorage.removeItem('remember_username');
      }
      ElMessage.success(`欢迎回来，${user.name}！`);
      setTimeout(() => { window.location.href = '/'; }, 500);
    } catch (error: any) {
      errorMessage.value = error.message || '登录失败，请检查用户名和密码';
    } finally {
      localLoading.value = false;
    }
  });
}

function handleOAuth2Login() {
  oauth2Loading.value = true;
  errorMessage.value = '';
  try {
    oauth2Login('/');
  } catch (error: any) {
    errorMessage.value = '跳转认证中心失败，请重试';
    oauth2Loading.value = false;
  }
}

const rememberedUsername = localStorage.getItem('remember_username');
if (rememberedUsername) {
  loginForm.username = rememberedUsername;
  rememberMe.value = true;
}
</script>

<style scoped>
/* ========================
   全局
   ======================== */
.login-page {
  min-height: 100vh;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif;
  background: #f0f2f5;
}

/* ========================
   左侧品牌展示区
   ======================== */
.login-brand {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 56px 56px 32px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.brand-bg-image {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(255,255,255,0.05) 0%, transparent 50%);
  z-index: 0;
}

.brand-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(102,126,234,0.92) 0%, rgba(118,75,162,0.92) 100%);
  z-index: 1;
}

/* 装饰几何图形 */
.brand-decorations {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
}

.deco-1 {
  width: 300px; height: 300px;
  top: -80px; right: -60px;
}

.deco-2 {
  width: 200px; height: 200px;
  bottom: 120px; left: -40px;
}

.deco-3 {
  width: 120px; height: 120px;
  top: 40%; right: 60px;
}

.deco-ring {
  position: absolute;
  width: 400px; height: 400px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
  bottom: -120px; right: -100px;
}

/* 内容区 */
.brand-content {
  position: relative;
  z-index: 2;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 36px;
}

/* 品牌头部 */
.brand-header {
  animation: fadeInUp 0.8s ease-out;
}

.brand-logo-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.brand-logo-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 80px; height: 80px;
  background: radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
}

.brand-logo {
  width: 60px; height: 60px;
  border-radius: 16px;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  border: 1.5px solid rgba(255,255,255,0.25);
  position: relative;
  z-index: 1;
}

.logo-svg {
  width: 36px; height: 36px;
}

.brand-title {
  font-size: 34px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 10px;
  letter-spacing: 1px;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 16px;
  color: rgba(255,255,255,0.85);
  font-weight: 400;
}

.brand-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
}

/* 核心亮点卡片 */
.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.feature-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 18px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  backdrop-filter: blur(8px);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.6s ease-out both;
}

.feature-card:hover {
  background: rgba(255,255,255,0.14);
  border-color: rgba(255,255,255,0.3);
  transform: translateX(6px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.feature-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: rgba(255,255,255,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.2);
}

.feature-card:hover .feature-icon {
  background: rgba(255,255,255,0.28);
  box-shadow: 0 0 20px rgba(255,255,255,0.15);
}

.feature-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.feature-content p {
  font-size: 13px;
  color: rgba(255,255,255,0.75);
  line-height: 1.55;
  margin: 0;
}

/* 数据指标 */
.brand-stats {
  display: flex;
  align-items: center;
  gap: 28px;
  animation: fadeInUp 0.8s ease-out 0.4s both;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255,255,255,0.65);
  font-weight: 500;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255,255,255,0.2);
}

/* 页脚 */
.brand-footer {
  position: relative;
  z-index: 2;
  animation: fadeInUp 0.8s ease-out 0.6s both;
}

.footer-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
  margin-bottom: 16px;
}

.brand-footer p {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  text-align: center;
  margin: 0;
}

/* ========================
   右侧登录表单区
   ======================== */
.login-form-side {
  width: 460px;
  min-width: 420px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
  box-shadow: -4px 0 30px rgba(0,0,0,0.06);
}

.form-container {
  width: 100%;
  max-width: 360px;
  animation: fadeInRight 0.8s ease-out;
}

@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 表单头部 */
.form-header {
  margin-bottom: 32px;
  text-align: center;
}

.form-avatar {
  margin-bottom: 20px;
}

.avatar-circle {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 16px rgba(102,126,234,0.3);
}

.form-header h2 {
  font-size: 26px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 6px;
}

.form-header p {
  font-size: 14px;
  color: #8c8c8c;
}

/* 错误提示 */
.error-alert {
  margin-bottom: 16px;
  border-radius: 10px;
}

/* Tabs */
.login-tabs {
  margin-bottom: 8px;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
  color: #8c8c8c;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
  transition: color 0.3s;
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
  margin-bottom: 18px;
}

.login-form :deep(.el-input__wrapper) {
  padding: 12px 14px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #e2e2e2 inset;
  transition: all 0.3s;
  background: #fafbfc;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c4c4c4 inset;
  background: #fff;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(102,126,234,0.35) inset;
  background: #fff;
}

.login-form :deep(.el-input__inner) {
  font-size: 14px;
  color: #1a1a2e;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.form-options :deep(.el-checkbox__label) {
  font-size: 13px;
  color: #8c8c8c;
}

/* 提交按钮 */
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

.submit-btn:active {
  transform: translateY(0);
}

/* 测试账号提示 */
.test-accounts-alert {
  margin-top: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f7ff 0%, #eef0ff 100%);
  border: 1px solid #d4d8f0;
}

.test-accounts-alert :deep(.el-alert__title) {
  font-size: 13px;
  font-weight: 600;
  color: #5b5ea6;
  margin-bottom: 6px;
}

.test-accounts {
  display: flex;
  justify-content: center;
}

.test-accounts code {
  background: rgba(102,126,234,0.08);
  padding: 4px 12px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #667eea;
  font-size: 12px;
  border: 1px solid rgba(102,126,234,0.15);
}

/* OAuth2 */
.oauth2-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 16px 0;
}

.oauth2-icon-wrap {
  margin-bottom: 4px;
}

.oauth2-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}

.oauth2-login h3 {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.oauth2-login p {
  font-size: 13px;
  color: #8c8c8c;
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
  transition: all 0.3s;
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
  padding: 14px 16px;
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

/* ========================
   动画
   ======================== */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

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
@media (max-width: 1100px) {
  .login-brand {
    padding: 40px 36px 24px;
  }
  .brand-title {
    font-size: 28px;
  }
  .login-form-side {
    width: 420px;
    min-width: 380px;
    padding: 48px 36px;
  }
}

@media (max-width: 900px) {
  .login-page {
    flex-direction: column;
  }
  .login-brand {
    min-height: auto;
    padding: 36px 28px 24px;
  }
  .brand-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .feature-card {
    padding: 14px;
  }
  .brand-stats {
    justify-content: center;
  }
  .brand-footer {
    margin-top: 24px;
  }
  .login-form-side {
    width: 100%;
    min-width: unset;
    padding: 40px 28px;
    flex: 1;
  }
}

@media (max-width: 600px) {
  .brand-title {
    font-size: 24px;
  }
  .brand-features {
    grid-template-columns: 1fr;
  }
  .brand-stats {
    gap: 16px;
  }
  .stat-value {
    font-size: 18px;
  }
  .login-form-side {
    padding: 32px 20px;
  }
  .form-header h2 {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand-logo-glow { animation: none; }
  .submit-btn:hover, .oauth2-btn:hover { transform: none; }
  .feature-card:hover { transform: none; }
}
</style>
