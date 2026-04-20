<script setup lang="ts">
</script>

<template>
  <div class="about-page">
    <el-card shadow="hover">
      <template #header>
        <span>关于系统</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="系统名称">AI Training 管理系统</el-descriptions-item>
        <el-descriptions-item label="版本号">v1.0.0</el-descriptions-item>
        <el-descriptions-item label="技术栈">Vue 3 + TypeScript + Element Plus + Vite</el-descriptions-item>
        <el-descriptions-item label="开发公司">北京东方金信科技股份有限公司</el-descriptions-item>
        <el-descriptions-item label="项目说明">
          AI Coding 培训脚手架项目，用于员工AI编程培训
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.about-page {
  max-width: 800px;
}
</style>
