<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="权限名称/编码/资源" clearable style="width: 220px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="action-bar">
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>新增权限
        </el-button>
      </div>

      <el-table :data="permissions" stripe v-loading="loading" row-key="id">
        <el-table-column prop="name" label="权限名称" width="160" />
        <el-table-column prop="code" label="编码" width="180" show-overflow-tooltip />
        <el-table-column prop="resource" label="资源" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="getResourceTagType(row.resource)">{{ row.resource }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editPermission(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end; display: flex"
        @current-change="loadPermissions"
        @size-change="loadPermissions"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑权限' : '新增权限'"
      width="680px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><Key /></el-icon>
          </span>
          <span>{{ editingId ? '编辑权限' : '新增权限' }}</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="90px"
        label-position="left"
        class="edit-form"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><InfoFilled /></el-icon></span>
            <span>基本信息</span>
          </div>

          <el-form-item label="权限名称" prop="name">
            <el-input v-model="form.name" placeholder="如: 查看用户" :prefix-icon="User" />
          </el-form-item>

          <el-form-item label="编码" prop="code">
            <el-input v-model="form.code" placeholder="如: user:view" :prefix-icon="Lock" />
            <div class="field-hint">格式建议：&lt;资源&gt;:&lt;操作&gt;，如 user:create、file:delete</div>
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              placeholder="请输入权限描述（选填）"
            />
          </el-form-item>
        </div>

        <el-divider margin="20px 0" />

        <!-- 资源与操作 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><Setting /></el-icon></span>
            <span>资源与操作</span>
          </div>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="资源" prop="resource">
                <el-select
                  v-model="form.resource"
                  placeholder="选择资源"
                  style="width: 100%"
                  filterable
                  allow-create
                >
                  <el-option
                    v-for="opt in resourceOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="操作" prop="action">
                <el-select
                  v-model="form.action"
                  placeholder="选择操作"
                  style="width: 100%"
                  filterable
                  allow-create
                >
                  <el-option
                    v-for="opt in actionOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 预览 -->
          <div class="code-preview" v-if="form.resource && form.action">
            <span class="preview-label">权限编码预览</span>
            <code class="preview-code">{{ form.resource }}:{{ form.action }}</code>
          </div>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default">取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : (editingId ? '保存修改' : '创建权限') }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Plus, Edit, Delete, Key, InfoFilled, Setting,
  User, Lock, Check,
} from '@element-plus/icons-vue'
import {
  getPermissions, createPermission, updatePermission, deletePermission,
  type SystemPermission
} from '@/api/system'

const permissions = ref<SystemPermission[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchForm = reactive({ keyword: '' })
const formRef = ref<FormInstance>()

const defaultForm = { name: '', code: '', resource: '', action: '', description: '' }
const form = reactive<typeof defaultForm>({ ...defaultForm })

const resourceOptions = [
  { label: '用户 (user)', value: 'user' },
  { label: '角色 (role)', value: 'role' },
  { label: '权限 (permission)', value: 'permission' },
  { label: '菜单 (menu)', value: 'menu' },
  { label: '任务 (task)', value: 'task' },
  { label: '文件 (file)', value: 'file' },
  { label: '分析 (analysis)', value: 'analysis' },
  { label: 'LLM (llm)', value: 'llm' },
  { label: 'RAG (rag)', value: 'rag' },
]

const actionOptions = [
  { label: '查看 (view)', value: 'view' },
  { label: '创建 (create)', value: 'create' },
  { label: '编辑 (edit)', value: 'edit' },
  { label: '删除 (delete)', value: 'delete' },
  { label: '管理 (manage)', value: 'manage' },
  { label: '上传 (upload)', value: 'upload' },
  { label: '执行 (execute)', value: 'execute' },
  { label: '使用 (use)', value: 'use' },
]

const rules: FormRules = {
  name: [
    { required: true, message: '请输入权限名称', trigger: 'blur' },
    { min: 2, max: 30, message: '权限名称长度 2-30 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入权限编码', trigger: 'blur' },
    { min: 3, max: 30, message: '编码长度 3-30 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_:]*$/, message: '编码必须以字母开头，格式: resource:action', trigger: 'blur' },
  ],
  resource: [
    { required: true, message: '请选择或输入资源名称', trigger: 'change' },
  ],
  action: [
    { required: true, message: '请选择或输入操作类型', trigger: 'change' },
  ],
}

const resourceTypeMap: Record<string, string> = {
  user: 'primary', role: 'success', permission: 'warning', menu: 'danger',
  task: '', file: 'info', analysis: '', llm: 'success', rag: 'warning',
}

function getResourceTagType(resource: string): string {
  return resourceTypeMap[resource] || 'info'
}

async function loadPermissions() {
  loading.value = true
  try {
    const res: any = await getPermissions({ page: currentPage.value, pageSize: pageSize.value, keyword: searchForm.keyword })
    if (res.success) { permissions.value = res.data.list; total.value = res.data.total }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function handleSearch() { currentPage.value = 1; loadPermissions() }
function handleReset() { searchForm.keyword = ''; currentPage.value = 1; loadPermissions() }

function showAddDialog() {
  editingId.value = null
  Object.assign(form, { ...defaultForm })
  formRef.value?.resetFields()
  dialogVisible.value = true
}

function editPermission(row: SystemPermission) {
  editingId.value = row.id!
  Object.assign(form, {
    name: row.name, code: row.code, resource: row.resource, action: row.action,
    description: row.description || '',
  })
  formRef.value?.resetFields()
  dialogVisible.value = true
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const payload = { ...form }
      const res: any = editingId.value
        ? await updatePermission(editingId.value, payload)
        : await createPermission(payload)
      if (res.success) {
        ElMessage.success(editingId.value ? '权限信息已更新' : '权限创建成功')
        dialogVisible.value = false
        loadPermissions()
      }
    } catch { /* ignore */ }
    finally { saving.value = false }
  })
}

async function handleDelete(row: SystemPermission) {
  try {
    await ElMessageBox.confirm(
      `确定要删除权限 "${row.name}" 吗？删除后不可恢复，关联角色的该权限将同步移除。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    const res: any = await deletePermission(row.id!)
    if (res.success) { ElMessage.success('权限已删除'); loadPermissions() }
  } catch { /* cancelled */ }
}

onMounted(() => { loadPermissions() })
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
</style>

<style>
/* 复用全局对话框样式 */
.form-dialog {
  --dialog-radius: 12px;
}

.form-dialog .el-dialog {
  border-radius: var(--dialog-radius);
  overflow: hidden;
}

.form-dialog .el-dialog__header {
  padding: 20px 24px 0;
  border-bottom: none;
}

.form-dialog .el-dialog__body {
  padding: 16px 24px 8px;
}

.form-dialog .el-dialog__footer {
  padding: 12px 24px 20px;
}

/* 对话框头部 */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
}

.dialog-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}

/* 表单分区标题 */
.form-section {
  margin-bottom: 4px;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 16px;
  padding-left: 2px;
}

.section-icon {
  display: flex;
  align-items: center;
  font-size: 14px;
}

/* 字段提示 */
.field-hint {
  display: block;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
}

/* 表单项调整 */
.edit-form .el-form-item {
  margin-bottom: 18px;
}

.edit-form .el-form-item__label {
  color: #4b5563;
  font-weight: 500;
}

.edit-form .el-input__wrapper,
.edit-form .el-select__wrapper {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e7eb inset;
  transition: all 0.2s;
}

.edit-form .el-input__wrapper:hover,
.edit-form .el-select__wrapper:hover {
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.edit-form .el-input.is-focus .el-input__wrapper,
.edit-form .el-select.is-focus .el-select__wrapper {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3) inset;
}

/* 编码预览 */
.code-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.04) 0%, rgba(118, 75, 162, 0.04) 100%);
  border-radius: 8px;
  border: 1px solid rgba(102, 126, 234, 0.12);
  margin-top: 2px;
}

.preview-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.preview-code {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 对话框底部 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-footer .el-button {
  border-radius: 8px;
  padding: 9px 20px;
  font-weight: 500;
}

.dialog-footer .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
}

.dialog-footer .el-button--primary:hover {
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
}
</style>
