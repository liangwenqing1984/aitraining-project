<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="用户名/姓名/邮箱" clearable style="width: 220px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
          <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="action-bar">
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>新增用户
        </el-button>
      </div>

      <el-table :data="users" stripe v-loading="loading" row-key="id">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column prop="email" label="邮箱" width="200" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="角色" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="role in row.roles" :key="role.id" size="small" style="margin: 2px 4px 2px 0">{{ role.name }}</el-tag>
            <span v-if="!row.roles || row.roles.length === 0" class="text-muted">未分配</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-switch v-model="row.status" size="small" @change="handleStatusChange(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editUser(row)">
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
        @current-change="loadUsers"
        @size-change="loadUsers"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑用户' : '新增用户'"
      width="680px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><UserFilled /></el-icon>
          </span>
          <span>{{ editingId ? '编辑用户' : '新增用户' }}</span>
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

          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="User"
              :disabled="!!editingId"
            />
            <div v-if="editingId" class="field-hint">用户名创建后不可修改</div>
          </el-form-item>

          <el-form-item :label="editingId ? '新密码' : '密码'" :prop="editingId ? 'passwordEdit' : 'password'">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              :placeholder="editingId ? '留空则不修改密码' : '请输入密码（至少6位）'"
              :prefix-icon="Lock"
            />
            <div class="field-hint">
              {{ editingId ? '留空则保持原密码不变' : '密码长度不少于 6 个字符，建议包含字母和数字' }}
            </div>
          </el-form-item>

          <el-form-item label="真实姓名" prop="realName">
            <el-input v-model="form.realName" placeholder="请输入真实姓名" :prefix-icon="User" />
          </el-form-item>

          <el-form-item label="邮箱" prop="email">
            <el-input v-model="form.email" placeholder="请输入邮箱地址" :prefix-icon="Message" />
          </el-form-item>

          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="请输入手机号码" :prefix-icon="Phone" />
          </el-form-item>
        </div>

        <el-divider margin="20px 0" />

        <!-- 角色与状态 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><Setting /></el-icon></span>
            <span>角色与状态</span>
          </div>

          <el-form-item label="角色" prop="roleIds">
            <el-select
              v-model="form.roleIds"
              multiple
              placeholder="请选择角色"
              style="width: 100%"
            >
              <el-option
                v-for="r in allRoles"
                :key="r.id"
                :label="r.name"
                :value="r.id"
              />
            </el-select>
            <div class="field-hint">分配角色后，用户将自动继承该角色的权限和菜单访问能力</div>
          </el-form-item>

          <el-form-item label="状态">
            <el-switch
              v-model="form.status"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
              style="--el-switch-on-color: #13ce66; --el-switch-off-color: #909399"
            />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default"><el-icon><Close /></el-icon>取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : (editingId ? '保存修改' : '创建用户') }}</span>
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
  Plus, Edit, Delete, UserFilled, InfoFilled, Setting,
  User, Lock, Message, Phone, Check, Search, RefreshLeft, Close,
} from '@element-plus/icons-vue'
import {
  getUsers, createUser, updateUser, deleteUser, getAllRoles,
  type SystemUser
} from '@/api/system'

const users = ref<SystemUser[]>([])
const allRoles = ref<{ id: number; name: string; code: string }[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchForm = reactive({ keyword: '' })
const formRef = ref<FormInstance>()

const defaultForm = {
  username: '', password: '', realName: '', email: '', phone: '', roleIds: [] as number[], status: true
}
const form = reactive<typeof defaultForm>({ ...defaultForm })

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度 3-20 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不少于 6 个字符', trigger: 'blur' },
  ],
  passwordEdit: [
    { min: 6, message: '密码长度不少于 6 个字符', trigger: 'blur' },
  ],
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' },
  ],
}

async function loadUsers() {
  loading.value = true
  try {
    const res: any = await getUsers({ page: currentPage.value, pageSize: pageSize.value, keyword: searchForm.keyword })
    if (res.success) {
      users.value = res.data.list
      total.value = res.data.total
    }
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

async function loadAllRoles() {
  try {
    const res: any = await getAllRoles()
    if (res.success) allRoles.value = res.data
  } catch { /* ignore */ }
}

function handleSearch() { currentPage.value = 1; loadUsers() }
function handleReset() { searchForm.keyword = ''; currentPage.value = 1; loadUsers() }

function showAddDialog() {
  editingId.value = null
  Object.assign(form, { ...defaultForm })
  formRef.value?.resetFields()
  dialogVisible.value = true
}

function editUser(row: SystemUser) {
  editingId.value = row.id!
  Object.assign(form, {
    username: row.username,
    password: '',
    realName: row.realName,
    email: row.email || '',
    phone: row.phone || '',
    roleIds: row.roleIds ? [...row.roleIds] : [],
    status: row.status,
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
      const payload: any = { ...form, password: form.password || undefined }
      const res: any = editingId.value
        ? await updateUser(editingId.value, payload)
        : await createUser(payload as any)
      if (res.success) {
        ElMessage.success(editingId.value ? '用户信息已更新' : '用户创建成功')
        dialogVisible.value = false
        loadUsers()
      }
    } catch { /* handled by interceptor */ }
    finally { saving.value = false }
  })
}

async function handleDelete(row: SystemUser) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.username}" 吗？删除后不可恢复。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    const res: any = await deleteUser(row.id!)
    if (res.success) { ElMessage.success('用户已删除'); loadUsers() }
  } catch { /* cancelled */ }
}

async function handleStatusChange(row: SystemUser) {
  try {
    await updateUser(row.id!, { status: row.status } as any)
  } catch { row.status = !row.status }
}

onMounted(() => {
  loadUsers()
  loadAllRoles()
})
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
.text-muted { color: #c0c4cc; font-size: 13px; }
</style>

<style>
/* 全局对话框样式（非 scoped，确保作用于 el-dialog 渲染到 body 的内容） */
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
