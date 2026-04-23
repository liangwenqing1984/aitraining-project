<template>
  <div class="login-page">
    <!-- 左侧品牌展示区 -->
    <div class="login-brand">
      <img src="@/assets/login-bg.svg" alt="" class="brand-bg-img" />
      <div class="brand-overlay"></div>
      <div class="brand-content">
        <div class="brand-logo">
          <el-icon :size="36"><Monitor /></el-icon>
        </div>
        <h1 class="brand-title">黑龙江高质量人才数据集</h1>
        <p class="brand-desc">智能招聘数据采集与分析平台</p>

        <div class="brand-features">
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="20"><Search /></el-icon>
            </div>
            <div class="feature-text">
              <h4>多源采集</h4>
              <p>支持前程无忧、智联招聘等主流招聘平台</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="20"><DataAnalysis /></el-icon>
            </div>
            <div class="feature-text">
              <h4>智能分析</h4>
              <p>职位数据自动解析、清洗与可视化洞察</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <el-icon :size="20"><Lock /></el-icon>
            </div>
            <div class="feature-text">
              <h4>安全可靠</h4>
              <p>企业级统一认证，数据加密传输与存储</p>
            </div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        <p>© 2026 AI Training System. All rights reserved.</p>
      </div>
    </div>

    <!-- 右侧登录表单区 -->
    <div class="login-form-side">
      <div class="form-wrapper">
        <div class="form-header">
          <h2>欢迎登录</h2>
          <p>请使用公司统一认证账号</p>
        </div>

        <!-- 显示错误信息 -->
        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          type="error"
          :closable="true"
          show-icon
          @close="errorMessage = ''"
          style="margin-bottom: 24px;"
        />

        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          <el-icon style="margin-right: 8px;"><Monitor /></el-icon>
          使用Auth服务登录
        </el-button>

        <div class="login-tips">
          <el-icon class="tip-icon" :size="14"><InfoFilled /></el-icon>
          <span>点击登录后将跳转到统一认证中心，登录成功会自动返回</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Monitor, Search, DataAnalysis, Lock, InfoFilled } from '@element-plus/icons-vue';
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
.login-page {
  min-height: 100vh;
  display: flex;
  overflow: hidden;
}

/* ========================
   左侧品牌展示区
   ======================== */
.login-brand {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px 48px;
  position: relative;
  overflow: hidden;
}

/* 背景图 */
.brand-bg-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: 0;
}

/* 深色渐变遮罩 - 确保文字可读性 */
.brand-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(160deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 40%, rgba(30,58,95,0.85) 100%);
  z-index: 1;
}

.brand-content {
  position: relative;
  z-index: 2;
  max-width: 440px;
}

.brand-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 28px;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.35);
}

.brand-title {
  font-size: 32px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
}

.brand-desc {
  font-size: 16px;
  color: #94a3b8;
  margin-bottom: 48px;
  line-height: 1.6;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #60a5fa;
  flex-shrink: 0;
}

.feature-text h4 {
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 4px;
}

.feature-text p {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.brand-footer {
  position: absolute;
  bottom: 32px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 2;
}

.brand-footer p {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.5);
}

/* ========================
   右侧登录表单区
   ======================== */
.login-form-side {
  width: 480px;
  min-width: 400px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
}

.form-wrapper {
  width: 100%;
  max-width: 360px;
}

.form-header {
  margin-bottom: 36px;
}

.form-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.form-header p {
  font-size: 15px;
  color: #94a3b8;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  border: none;
  transition: all 0.25s ease;
}

.login-btn:hover {
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
  transform: translateY(-1px);
}

.login-tips {
  margin-top: 24px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.tip-icon {
  color: #94a3b8;
  margin-top: 2px;
  flex-shrink: 0;
}

/* ========================
   响应式适配
   ======================== */
@media (max-width: 900px) {
  .login-page {
    flex-direction: column;
  }

  .login-brand {
    padding: 40px 24px;
    min-height: auto;
  }

  .brand-features {
    display: none;
  }

  .brand-footer {
    display: none;
  }

  .login-form-side {
    width: 100%;
    min-width: unset;
    padding: 40px 24px;
    flex: 1;
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .login-btn:hover {
    transform: none;
  }
}
</style>