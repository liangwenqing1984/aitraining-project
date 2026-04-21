<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>🤖 AI训练数据爬虫系统</h1>
        <p class="subtitle">智能招聘数据采集与分析平台</p>
      </div>

      <el-card class="login-card" shadow="always">
        <div class="login-form">
          <div class="welcome-text">
            <h2>欢迎使用</h2>
            <p>请使用公司统一认证账号登录</p>
          </div>

          <!-- 显示错误信息 -->
          <el-alert
            v-if="errorMessage"
            :title="errorMessage"
            type="error"
            :closable="true"
            show-icon
            @close="errorMessage = ''"
            style="margin-bottom: 20px;"
          />

          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            <el-icon style="margin-right: 8px;">
              <User />
            </el-icon>
            使用Auth服务登录
          </el-button>

          <div class="login-tips">
            <el-alert
              title="提示"
              type="info"
              :closable="false"
              show-icon
            >
              <template #default>
                <p>点击登录后将跳转到统一认证中心</p>
                <p>登录成功后会自动返回本系统</p>
              </template>
            </el-alert>
          </div>
        </div>
      </el-card>

      <div class="footer">
        <p>© 2026 AI Training System. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { User } from '@element-plus/icons-vue';
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
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 480px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.login-header h1 {
  font-size: 32px;
  margin-bottom: 12px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.subtitle {
  font-size: 16px;
  opacity: 0.9;
}

.login-card {
  border-radius: 16px;
  overflow: hidden;
}

.login-form {
  padding: 20px;
}

.welcome-text {
  text-align: center;
  margin-bottom: 32px;
}

.welcome-text h2 {
  font-size: 24px;
  color: #303133;
  margin-bottom: 8px;
}

.welcome-text p {
  color: #909399;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.login-tips {
  margin-top: 24px;
}

.login-tips p {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.6;
}

.footer {
  text-align: center;
  margin-top: 40px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}
</style>