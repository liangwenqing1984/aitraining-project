<template>
  <div class="login-page">
    <!-- 左侧品牌展示区 -->
    <div class="login-brand">
      <div class="brand-bg-image"></div>
      <div class="brand-overlay"></div>

      <div class="brand-content">
        <div class="brand-header">
          <div class="brand-logo-wrapper">
            <div class="brand-logo-glow"></div>
            <div class="brand-logo">
              <el-icon :size="40"><Monitor /></el-icon>
            </div>
          </div>
          <h1 class="brand-title">黑龙江高质量人才数据集</h1>
          <p class="brand-subtitle">智能招聘数据采集与分析平台</p>
        </div>

        <div class="brand-divider"></div>

        <div class="brand-features">
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">
                <el-icon :size="24"><Search /></el-icon>
              </div>
            </div>
            <div class="feature-content">
              <h4>多源采集</h4>
              <p>支持前程无忧、智联招聘等主流招聘平台数据自动采集</p>
            </div>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">
                <el-icon :size="24"><DataAnalysis /></el-icon>
              </div>
            </div>
            <div class="feature-content">
              <h4>智能分析</h4>
              <p>职位数据自动解析、清洗与多维度可视化洞察</p>
            </div>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">
                <el-icon :size="24"><Lock /></el-icon>
              </div>
            </div>
            <div class="feature-content">
              <h4>安全可靠</h4>
              <p>支持企业级OAuth2统一认证和本地账号双重登录方式</p>
            </div>
          </div>
        </div>

        <div class="brand-stats">
          <div class="stat-item">
            <div class="stat-value">10+</div>
            <div class="stat-label">数据源支持</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">99.9%</div>
            <div class="stat-label">系统可用性</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">实时</div>
            <div class="stat-label">数据更新</div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        <div class="footer-divider"></div>
        <p>© 2026 AI Training System · 黑龙江人才数据中心</p>
      </div>
    </div>

    <!-- 右侧登录表单区 -->
    <div class="login-form-side">
      <div class="form-container">
        <div class="form-header">
          <h2>欢迎登录</h2>
          <p>请选择登录方式进入系统</p>
        </div>

        <!-- 显示错误信息 -->
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

        <!-- 登录方式切换 Tabs -->
        <el-tabs v-model="activeTab" class="login-tabs">
          <!-- 本地登录 Tab -->
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
                  <el-checkbox v-model="rememberMe">记住我</el-checkbox>
                  <el-link type="primary" :underline="false">忘记密码?</el-link>
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
                  {{ localLoading ? '登录中...' : '登 录' }}
                </el-button>
              </el-form-item>

              <!-- 测试账号提示 -->
              <el-alert
                title="测试账号"
                type="info"
                :closable="false"
                show-icon
                class="test-accounts-alert"
              >
                <template #default>
                  <div class="test-accounts">
                    <div class="account-item">
                      <span class="account-label">管理员:</span>
                      <code>admin / Admin@admin123</code>
                    </div>
                    <div class="account-item">
                      <span class="account-label">普通用户:</span>
                      <code>user / User@123456</code>
                    </div>
                    <div class="account-item">
                      <span class="account-label">测试用户:</span>
                      <code>test / Test@123456</code>
                    </div>
                  </div>
                </template>
              </el-alert>
            </el-form>
          </el-tab-pane>

          <!-- OAuth2 登录 Tab -->
          <el-tab-pane label="统一认证" name="oauth2">
            <div class="oauth2-login">
              <div class="oauth2-info">
                <el-icon :size="48" color="#409EFF"><Connection /></el-icon>
                <h3>企业统一认证</h3>
                <p>使用公司统一身份认证中心账号登录</p>
              </div>

              <el-button
                type="primary"
                size="large"
                class="oauth2-btn"
                :loading="oauth2Loading"
                @click="handleOAuth2Login"
              >
                <span class="btn-content">
                  <el-icon v-if="!oauth2Loading" :size="20"><Promotion /></el-icon>
                  <span>{{ oauth2Loading ? '跳转中...' : '前往统一认证中心' }}</span>
                </span>
              </el-button>

              <div class="oauth2-tips">
                <div class="tip-item">
                  <el-icon class="tip-icon" :size="14"><CircleCheckFilled /></el-icon>
                  <span>单点登录,一次认证全站通行</span>
                </div>
                <div class="tip-item">
                  <el-icon class="tip-icon" :size="14"><Key /></el-icon>
                  <span>企业级安全加密保护</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="login-footer">
          <el-divider />
          <div class="help-links">
            <span class="help-text">遇到问题?</span>
            <el-link type="primary" :underline="false">联系管理员</el-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { 
  Monitor, 
  Search, 
  DataAnalysis, 
  Lock, 
  User,
  Connection,
  Promotion,
  CircleCheckFilled,
  Key
} from '@element-plus/icons-vue';
import { login as oauth2Login } from '@/utils/auth';
import { ElMessage } from 'element-plus';

const route = useRoute();
const activeTab = ref('local');
const localLoading = ref(false);
const oauth2Loading = ref(false);
const errorMessage = ref('');
const rememberMe = ref(false);

// 登录表单
const loginFormRef = ref<FormInstance>();
const loginForm = reactive({
  username: '',
  password: ''
});

// 模拟本地用户数据(实际项目应从后端获取)
const MOCK_USERS = [
  {
    username: 'admin',
    password: 'Admin@admin123',
    name: '系统管理员',
    role: 'admin'
  },
  {
    username: 'user',
    password: 'User@123456',
    name: '普通用户',
    role: 'user'
  },
  {
    username: 'test',
    password: 'Test@123456',
    name: '测试用户',
    role: 'user'
  }
];

// 表单验证规则
const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 个字符', trigger: 'blur' }
  ]
};

// 页面加载时检查是否有 OAuth2 回调错误
if (route.query.error) {
  const error = route.query.error as string;
  const errorDescription = route.query.error_description as string;
  
  console.error('[Login] 登录错误:', error, errorDescription);
  
  switch (error) {
    case 'missing_code':
      errorMessage.value = '缺少授权码,请重新登录';
      break;
    case 'token_exchange_failed':
      errorMessage.value = `Token交换失败:${errorDescription || '请稍后重试'}`;
      break;
    case 'unknown_error':
      errorMessage.value = `登录失败:${errorDescription || '未知错误'}`;
      break;
    default:
      errorMessage.value = errorDescription || '登录失败,请重试';
  }
  
  // 切换到 OAuth2 tab
  activeTab.value = 'oauth2';
}

/**
 * 本地登录处理(前端模拟验证)
 */
const handleLocalLogin = async () => {
  if (!loginFormRef.value) return;
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      localLoading.value = true;
      errorMessage.value = '';
      
      try {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 查找匹配的用户
        const user = MOCK_USERS.find(
          u => u.username === loginForm.username && u.password === loginForm.password
        );
        
        if (!user) {
          throw new Error('用户名或密码错误');
        }
        
        // 登录成功,保存用户信息到 localStorage
        const userInfo = {
          username: user.username,
          name: user.name,
          role: user.role,
          loginTime: new Date().toISOString(),
          loginType: 'local'  // 标记为本地登录
        };
        
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('is_authenticated', 'true');
        
        // 如果勾选了记住我,保存用户名
        if (rememberMe.value) {
          localStorage.setItem('remember_username', loginForm.username);
        } else {
          localStorage.removeItem('remember_username');
        }
        
        ElMessage.success(`欢迎回来,${user.name}!`);
        
        // 延迟跳转,让用户看到成功提示
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
        
      } catch (error: any) {
        console.error('[Login] 本地登录失败:', error);
        errorMessage.value = error.message || '登录失败,请检查用户名和密码';
        ElMessage.error(errorMessage.value);
      } finally {
        localLoading.value = false;
      }
    }
  });
};

/**
 * OAuth2 登录处理
 */
const handleOAuth2Login = () => {
  oauth2Loading.value = true;
  errorMessage.value = '';
  
  try {
    // 调用 OAuth2 登录(会直接跳转)
    oauth2Login('/');
  } catch (error: any) {
    console.error('[Login] OAuth2 登录失败:', error);
    errorMessage.value = '跳转认证中心失败,请重试';
    ElMessage.error(errorMessage.value);
    oauth2Loading.value = false;
  }
};

// 页面加载时,如果有记住的用户名,自动填充
const rememberedUsername = localStorage.getItem('remember_username');
if (rememberedUsername) {
  loginForm.username = rememberedUsername;
  rememberMe.value = true;
}
</script>

<style scoped>
/* ========================
   全局样式 - Gitee 风格
   ======================== */
.login-page {
  min-height: 100vh;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
}

/* ========================
   左侧品牌展示区
   ======================== */
.login-brand {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 60px 56px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 背景图片层 */
.brand-bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('@/assets/login-bg.svg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.15;
  z-index: 0;
}

/* 渐变遮罩 */
.brand-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
  z-index: 1;
}

.brand-content {
  position: relative;
  z-index: 2;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* 品牌头部 */
.brand-header {
  animation: fadeInUp 0.8s ease-out;
}

.brand-logo-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 24px;
}

.brand-logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 3s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 1;
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
  font-weight: 400;
}

/* 分隔线 */
.brand-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
}

/* 特性卡片 */
.brand-features {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeInUp 0.8s ease-out 0.2s both;
}

.feature-card {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateX(8px);
}

.feature-icon-wrapper {
  flex-shrink: 0;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.feature-content h4 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px;
}

.feature-content p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin: 0;
}

/* 统计数据 */
.brand-stats {
  display: flex;
  gap: 32px;
  padding-top: 8px;
  animation: fadeInUp 0.8s ease-out 0.4s both;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

/* 页脚 */
.brand-footer {
  position: relative;
  z-index: 2;
  animation: fadeInUp 0.8s ease-out 0.6s both;
}

.footer-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
  margin-bottom: 20px;
}

.brand-footer p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  margin: 0;
}

/* ========================
   右侧登录表单区 - Gitee 简洁风格
   ======================== */
.login-form-side {
  width: 480px;
  min-width: 440px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
  position: relative;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);
}

.form-container {
  width: 100%;
  max-width: 380px;
  animation: fadeInRight 0.8s ease-out;
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 表单头部 */
.form-header {
  margin-bottom: 32px;
  text-align: center;
}

.form-header h2 {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  letter-spacing: -0.3px;
}

.form-header p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

/* 错误提示 */
.error-alert {
  margin-bottom: 20px;
  border-radius: 8px;
}

/* Tabs 样式优化 */
.login-tabs {
  margin-bottom: 24px;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
  border-bottom: 2px solid #e8e8e8;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
  color: #666;
  padding: 0 24px;
  height: 44px;
  line-height: 44px;
  transition: all 0.3s;
}

.login-tabs :deep(.el-tabs__item:hover) {
  color: #667eea;
}

.login-tabs :deep(.el-tabs__item.is-active) {
  color: #667eea;
  font-weight: 600;
}

.login-tabs :deep(.el-tabs__active-bar) {
  height: 3px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
}

/* 登录表单 */
.login-form {
  margin-top: 8px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-input__wrapper) {
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #d9d9d9 inset;
  transition: all 0.3s;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #667eea inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #667eea inset;
}

.login-form :deep(.el-input__inner) {
  font-size: 14px;
  color: #1a1a1a;
}

/* 表单选项 */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.form-options :deep(.el-checkbox__label) {
  font-size: 14px;
  color: #666;
}

.form-options :deep(.el-link) {
  font-size: 14px;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s;
  letter-spacing: 2px;
}

.submit-btn:hover {
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  transform: translateY(-2px);
}

.submit-btn:active {
  transform: translateY(0);
}

/* 测试账号提示 */
.test-accounts-alert {
  margin-top: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
}

.test-accounts-alert :deep(.el-alert__title) {
  font-size: 13px;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 8px;
}

.test-accounts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.account-label {
  color: #0c4a6e;
  font-weight: 500;
  min-width: 70px;
}

.account-item code {
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #0369a1;
  font-size: 11px;
  border: 1px solid #bae6fd;
}

/* OAuth2 登录区域 */
.oauth2-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
}

.oauth2-info {
  text-align: center;
}

.oauth2-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 16px 0 8px;
}

.oauth2-info p {
  font-size: 13px;
  color: #999;
  line-height: 1.6;
}

.oauth2-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s;
}

.oauth2-btn:hover {
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  transform: translateY(-2px);
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
  gap: 12px;
  width: 100%;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
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

/* 页脚 */
.login-footer {
  margin-top: 24px;
}

.login-footer :deep(.el-divider) {
  margin: 0;
  border-color: #e8e8e8;
}

.help-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 13px;
}

.help-text {
  color: #999;
}

/* ========================
   动画
   ======================== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ========================
   响应式适配
   ======================== */
@media (max-width: 1200px) {
  .login-brand {
    padding: 48px 40px;
  }
  
  .brand-title {
    font-size: 32px;
  }
  
  .login-form-side {
    width: 440px;
    min-width: 400px;
    padding: 48px 40px;
  }
}

@media (max-width: 1024px) {
  .login-page {
    flex-direction: column;
  }

  .login-brand {
    padding: 40px 32px;
    min-height: auto;
  }

  .brand-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .brand-stats {
    justify-content: space-around;
  }

  .brand-footer {
    margin-top: 32px;
  }

  .login-form-side {
    width: 100%;
    min-width: unset;
    padding: 48px 32px;
    flex: 1;
  }
}

@media (max-width: 768px) {
  .login-brand {
    padding: 32px 24px;
  }

  .brand-title {
    font-size: 28px;
  }

  .brand-features {
    grid-template-columns: 1fr;
  }

  .brand-stats {
    gap: 20px;
  }

  .stat-value {
    font-size: 24px;
  }

  .login-form-side {
    padding: 40px 24px;
  }

  .form-header h2 {
    font-size: 24px;
  }

  .login-tabs :deep(.el-tabs__item) {
    padding: 0 16px;
    font-size: 14px;
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .brand-logo-glow {
    animation: none;
  }
  
  .submit-btn:hover,
  .oauth2-btn:hover {
    transform: none;
  }
  
  .feature-card:hover {
    transform: none;
  }
}
</style>
