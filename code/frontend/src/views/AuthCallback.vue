<template>
  <div class="auth-callback">
    <div class="callback-content">
      <el-icon class="loading-icon" :size="50">
        <Loading />
      </el-icon>
      <h2>{{ statusText }}</h2>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <el-button v-if="showRetry" type="primary" @click="handleRetry">
        重试
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const router = useRouter();
const statusText = ref('认证成功，正在跳转...');
const errorMessage = ref('');
const showRetry = ref(false);

onMounted(() => {
  try {
    // 从URL参数中获取错误信息（如果有）
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // 检查是否有授权错误
    if (error) {
      throw new Error(`授权失败: ${error} - ${errorDescription || '未知错误'}`);
    }

    console.log('[Auth Callback] 认证完成，准备跳转到首页...');

    statusText.value = '认证成功，正在跳转到首页...';
    
    // 清除URL中的敏感参数
    window.history.replaceState({}, document.title, '/auth/callback');
    
    // 延迟跳转到首页，让用户看到提示
    setTimeout(() => {
      router.push('/').catch(err => {
        console.error('[Auth Callback] 跳转失败:', err);
        // 如果跳转失败，强制刷新页面
        window.location.href = '/';
      });
    }, 800);

  } catch (error: any) {
    console.error('[Auth Callback] 处理失败:', error);
    
    statusText.value = '登录失败';
    errorMessage.value = error.message || '未知错误';
    showRetry.value = true;
    
    ElMessage.error(errorMessage.value);
  }
});

const handleRetry = () => {
  // 重新尝试登录
  window.location.href = '/login';
};
</script>

<style scoped>
.auth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.callback-content {
  text-align: center;
  background: white;
  padding: 60px 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 90%;
}

.loading-icon {
  color: #667eea;
  animation: rotate 1.5s linear infinite;
  margin-bottom: 20px;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

h2 {
  color: #303133;
  font-size: 24px;
  margin-bottom: 16px;
}

.error-message {
  color: #f56c6c;
  font-size: 14px;
  margin-top: 16px;
  line-height: 1.6;
}

.el-button {
  margin-top: 24px;
}
</style>
