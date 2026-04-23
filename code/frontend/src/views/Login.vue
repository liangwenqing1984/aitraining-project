<template>
  <div class="login-page">
    <!-- 左侧品牌展示区 -->
    <div class="login-brand">
      <!-- 固定背景图片 -->
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
              <p>企业级OAuth2统一认证，数据加密传输与存储</p>
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
          <div class="welcome-badge">
            <el-icon :size="16"><CircleCheckFilled /></el-icon>
            <span>安全连接已建立</span>
          </div>
          <h2>欢迎回来</h2>
          <p>请使用公司统一认证账号登录系统</p>
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

        <div class="login-action-area">
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            <span class="btn-content">
              <el-icon v-if="!loading" :size="20"><Monitor /></el-icon>
              <span>{{ loading ? '正在跳转认证...' : '使用Auth服务登录' }}</span>
            </span>
          </el-button>

          <div class="security-tips">
            <div class="tip-item">
              <el-icon class="tip-icon" :size="16"><Connection /></el-icon>
              <span>企业级SSL加密保护</span>
            </div>
            <div class="tip-item">
              <el-icon class="tip-icon" :size="16"><Clock /></el-icon>
              <span>会话超时自动保护</span>
            </div>
          </div>
        </div>

        <div class="login-info">
          <el-icon class="info-icon" :size="16"><InfoFilled /></el-icon>
          <div class="info-text">
            <p>点击后将跳转到统一认证中心</p>
            <p>登录成功后会自动返回本系统</p>
          </div>
        </div>

        <div class="help-links">
          <a href="#" class="help-link">遇到问题？</a>
          <span class="divider">·</span>
          <a href="#" class="help-link">联系管理员</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { 
  Monitor, 
  Search, 
  DataAnalysis, 
  Lock, 
  InfoFilled,
  CircleCheckFilled,
  Connection,
  Clock
} from '@element-plus/icons-vue';
import { login } from '@/utils/auth';

const route = useRoute();
const loading = ref(false);
const errorMessage = ref('');

onMounted(() => {
  // 检查URL中是否有错误参数
  const error = route.query.error as string;
  const errorDescription = route.query.error_description as string;
  
  if (error) {
    console.error('[Login] 登录错误:', error, errorDescription);
    
    // 根据错误类型显示友好提示
    switch (error) {
      case 'missing_code':
        errorMessage.value = '缺少授权码，请重新登录';
        break;
      case 'token_exchange_failed':
        errorMessage.value = `Token交换失败：${errorDescription || '请稍后重试'}`;
        break;
      case 'unknown_error':
        errorMessage.value = `登录失败：${errorDescription || '未知错误'}`;
        break;
      default:
        errorMessage.value = errorDescription || '登录失败，请重试';
    }
  }
});

const handleLogin = () => {
  loading.value = true;
  
  // 调用OAuth2登录
  login('/');
  
  // login()会直接跳转，所以这里不需要设置loading为false
};
</script>

<style scoped>
/* ========================
   全局样式
   ======================== */
.login-page {
  min-height: 100vh;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
}

/* 固定背景图片 */
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
  z-index: 0;
}

/* 深色渐变遮罩 - 确保文字可读性 */
.brand-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.80) 50%, rgba(30,58,95,0.75) 100%);
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
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
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
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 
    0 8px 32px rgba(59, 130, 246, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 17px;
  color: #94a3b8;
  line-height: 1.6;
  font-weight: 400;
}

/* 分隔线 */
.brand-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.3) 50%, transparent 100%);
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateX(8px);
}

.feature-icon-wrapper {
  flex-shrink: 0;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.feature-content h4 {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 6px;
}

.feature-content p {
  font-size: 14px;
  color: #94a3b8;
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
  color: #f8fafc;
  margin-bottom: 4px;
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
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
  background: linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.2) 50%, transparent 100%);
  margin-bottom: 20px;
}

.brand-footer p {
  font-size: 13px;
  color: rgba(148, 163, 184, 0.6);
  text-align: center;
  margin: 0;
}

/* ========================
   右侧登录表单区
   ======================== */
.login-form-side {
  width: 520px;
  min-width: 480px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 56px;
  position: relative;
}

.form-container {
  width: 100%;
  max-width: 400px;
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
  margin-bottom: 40px;
}

.welcome-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
  border-radius: 20px;
  font-size: 12px;
  color: #059669;
  font-weight: 500;
  margin-bottom: 20px;
}

.welcome-badge .el-icon {
  color: #10b981;
}

.form-header h2 {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 10px;
  letter-spacing: -0.5px;
}

.form-header p {
  font-size: 15px;
  color: #64748b;
  line-height: 1.6;
}

/* 错误提示 */
.error-alert {
  margin-bottom: 24px;
  border-radius: 12px;
}

/* 登录操作区 */
.login-action-area {
  margin-bottom: 32px;
}

.login-btn {
  width: 100%;
  height: 56px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.login-btn:hover::before {
  left: 100%;
}

.login-btn:hover {
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
  transform: translateY(-2px);
}

.login-btn:active {
  transform: translateY(0);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* 安全提示 */
.security-tips {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  flex: 1;
  justify-content: center;
}

.tip-item .tip-icon {
  color: #10b981;
}

/* 登录信息 */
.login-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 20px;
}

.info-icon {
  color: #3b82f6;
  margin-top: 2px;
  flex-shrink: 0;
}

.info-text {
  flex: 1;
}

.info-text p {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

/* 帮助链接 */
.help-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
}

.help-link {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
  font-weight: 500;
}

.help-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.divider {
  color: #cbd5e1;
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
    width: 480px;
    min-width: 440px;
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
    font-size: 28px;
  }

  .security-tips {
    flex-direction: column;
    gap: 12px;
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .brand-logo-glow {
    animation: none;
  }
  
  .login-btn:hover {
    transform: none;
  }
  
  .feature-card:hover {
    transform: none;
  }
}
</style>