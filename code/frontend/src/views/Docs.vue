<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { marked } from 'marked'

const markdownContent = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    loading.value = true
    // 从public目录读取README.md
    const response = await fetch('/README.md')
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const text = await response.text()
    // 使用marked解析Markdown
    markdownContent.value = marked.parse(text) as string
  } catch (err: any) {
    console.error('加载README失败:', err)
    error.value = `加载文档失败: ${err.message}`
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="docs-container">
    <el-card class="docs-card">
      <template #header>
        <div class="card-header">
          <h2>📖 项目文档</h2>
          <el-tag type="info">README.md</el-tag>
        </div>
      </template>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>正在加载文档...</p>
      </div>

      <!-- 错误状态 -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
      />

      <!-- 文档内容 -->
      <div v-else class="markdown-body" v-html="markdownContent"></div>
    </el-card>
  </div>
</template>

<style scoped>
.docs-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.docs-card {
  min-height: calc(100vh - 140px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.loading-state .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Markdown样式美化 */
.markdown-body {
  line-height: 1.8;
  color: #303133;
  font-size: 15px;
}

.markdown-body :deep(h1) {
  font-size: 32px;
  font-weight: 600;
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e4e7ed;
  color: #303133;
}

.markdown-body :deep(h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 28px 0 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e4e7ed;
  color: #303133;
}

.markdown-body :deep(h3) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px;
  color: #303133;
}

.markdown-body :deep(h4) {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: #303133;
}

.markdown-body :deep(p) {
  margin: 12px 0;
  line-height: 1.8;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin: 6px 0;
  line-height: 1.8;
}

.markdown-body :deep(a) {
  color: #409eff;
  text-decoration: none;
  transition: color 0.3s;
}

.markdown-body :deep(a:hover) {
  color: #66b1ff;
  text-decoration: underline;
}

.markdown-body :deep(code) {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  color: #e6a23c;
}

.markdown-body :deep(pre) {
  background-color: #282c34;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: #abb2bf;
  font-size: 14px;
  line-height: 1.6;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #409eff;
  padding: 12px 16px;
  margin: 16px 0;
  background-color: #f4f4f5;
  border-radius: 4px;
  color: #606266;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  overflow-x: auto;
  display: block;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 10px 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #303133;
}

.markdown-body :deep(tr:nth-child(even)) {
  background-color: #fafafa;
}

.markdown-body :deep(tr:hover) {
  background-color: #f5f7fa;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 12px 0;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 2px solid #e4e7ed;
  margin: 24px 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: #303133;
}

.markdown-body :deep(em) {
  font-style: italic;
  color: #606266;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .docs-container {
    padding: 10px;
  }

  .markdown-body :deep(h1) {
    font-size: 26px;
  }

  .markdown-body :deep(h2) {
    font-size: 22px;
  }

  .markdown-body :deep(h3) {
    font-size: 18px;
  }

  .markdown-body :deep(table) {
    font-size: 13px;
  }

  .markdown-body :deep(th),
  .markdown-body :deep(td) {
    padding: 8px 10px;
  }
}
</style>
