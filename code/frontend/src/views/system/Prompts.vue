<template>
  <div class="prompts-page">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <span class="category-title">{{ categoryLabel }} — 提示词管理</span>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 新增提示词
      </el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.promptType === 'system' ? 'warning' : 'primary'" size="small">
            {{ row.promptType === 'system' ? 'System' : 'User' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="变量" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="v in (row.variables || [])" :key="v" size="small" style="margin:1px" effect="plain">{{ v }}</el-tag>
          <span v-if="!row.variables || row.variables.length === 0" style="color:#999">--</span>
        </template>
      </el-table-column>
      <el-table-column label="内容预览" min-width="200">
        <template #default="{ row }">
          <span style="color:#666; font-size:12px; font-family: monospace;">{{ (row.content || '').substring(0, 80) }}{{ (row.content || '').length > 80 ? '...' : '' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="启用" width="70">
        <template #default="{ row }">
          <el-switch v-model="row.isActive" size="small" @change="(val: boolean) => handleToggle(row, val)" />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160">
        <template #default="{ row }">
          {{ row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-CN') : '--' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="warning" size="small" @click="handleReset(row)">重置</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑提示词' : '新增提示词'"
      width="800px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="right">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：数据增强系统提示词" maxlength="100" />
        </el-form-item>
        <el-form-item label="类型" prop="promptType">
          <el-radio-group v-model="form.promptType">
            <el-radio value="system">System Prompt</el-radio>
            <el-radio value="user">User Prompt</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
          <span style="margin-left:8px; color:#999; font-size:12px">同一分类下仅一个 System 和一个 User 可同时启用</span>
        </el-form-item>
        <el-form-item label="提示词内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            placeholder="输入提示词文本。User Prompt 中可使用 ${varName} 作为模板变量占位符。"
            style="font-family: 'Consolas', 'Courier New', monospace; font-size: 13px;"
          />
        </el-form-item>
        <el-form-item label="模板变量">
          <el-select
            v-model="form.variables"
            multiple filterable allow-create default-first-option
            placeholder="输入变量名后回车添加（仅 User Prompt 需要）"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选，简要说明此提示词的用途" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  listPrompts, createPrompt, updatePrompt, deletePrompt, resetDefault,
  CATEGORY_LABELS, type PromptRecord
} from '@/api/prompt'

const route = useRoute()

const list = ref<PromptRecord[]>([])
const loading = ref(false)

const category = computed(() => {
  const segments = route.path.split('/')
  return segments[segments.length - 1]
})
const categoryLabel = computed(() => CATEGORY_LABELS[category.value] || category.value)

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const defaultForm = () => ({
  name: '',
  promptType: 'system' as 'system' | 'user',
  content: '',
  variables: [] as string[],
  description: '',
  isActive: true,
})

const form = reactive(defaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  promptType: [{ required: true, message: '请选择类型', trigger: 'change' }],
  content: [{ required: true, message: '请输入提示词内容', trigger: 'blur' }],
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listPrompts(category.value)
    if (res.success) {
      list.value = res.data || []
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openDialog(row?: PromptRecord) {
  if (row) {
    isEdit.value = true
    editId.value = row.id!
    Object.assign(form, {
      name: row.name,
      promptType: row.promptType,
      content: row.content,
      variables: [...(row.variables || [])],
      description: row.description || '',
      isActive: row.isActive,
    })
  } else {
    isEdit.value = false
    editId.value = null
    Object.assign(form, defaultForm())
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value && editId.value) {
      await updatePrompt(editId.value, { ...form, category: category.value })
      ElMessage.success('更新成功')
    } else {
      await createPrompt({ ...form, category: category.value, sortOrder: 0 })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleToggle(row: PromptRecord, val: boolean) {
  try {
    await updatePrompt(row.id!, { isActive: val, category: row.category, promptType: row.promptType })
    fetchList()
  } catch (e: any) {
    row.isActive = !val
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleReset(row: PromptRecord) {
  try {
    await ElMessageBox.confirm(
      `确定将「${row.name}」重置为默认值？当前内容将被覆盖。`,
      '确认重置', { type: 'warning' }
    )
    await resetDefault(row.category, row.promptType)
    ElMessage.success('已重置为默认值')
    fetchList()
  } catch { /* 用户取消 */ }
}

async function handleDelete(row: PromptRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除提示词「${row.name}」？此操作不可恢复。`,
      '确认删除', { type: 'warning' }
    )
    await deletePrompt(row.id!)
    ElMessage.success('删除成功')
    fetchList()
  } catch { /* 用户取消 */ }
}

watch(category, () => { fetchList() })

onMounted(() => { fetchList() })
</script>

<style scoped>
.prompts-page { padding: 0; }
.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.toolbar-left { display: flex; gap: 12px; }
.category-title { font-size: 16px; font-weight: 600; color: #303133; }

/* 编辑器中的 ${} 语法高亮暗示 */
:deep(.el-textarea__inner) { line-height: 1.6; }
</style>
