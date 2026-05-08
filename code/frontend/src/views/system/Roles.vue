<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="角色名称/编码" clearable style="width: 220px" @keyup.enter="handleSearch" />
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
          <el-icon><Plus /></el-icon>新增角色
        </el-button>
      </div>

      <el-table :data="roles" stripe v-loading="loading" row-key="id">
        <el-table-column prop="name" label="角色名称" width="140" />
        <el-table-column prop="code" label="编码" width="140" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-switch v-model="row.status" size="small" @change="handleStatusChange(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editRole(row)">
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
        @current-change="loadRoles"
        @size-change="loadRoles"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑角色' : '新增角色'"
      width="800px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><UserFilled /></el-icon>
          </span>
          <span>{{ editingId ? '编辑角色' : '新增角色' }}</span>
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

          <el-form-item label="角色名称" prop="name">
            <el-input v-model="form.name" placeholder="请输入角色名称" :prefix-icon="User" />
          </el-form-item>

          <el-form-item label="编码" prop="code">
            <el-input
              v-model="form.code"
              placeholder="如: admin, operator"
              :prefix-icon="Lock"
              :disabled="!!editingId"
            />
            <div class="field-hint">角色唯一标识，创建后不可修改。建议使用小写英文和下划线</div>
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              placeholder="请输入角色描述（选填）"
            />
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

        <el-divider margin="20px 0" />

        <!-- 菜单与权限 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><Menu /></el-icon></span>
            <span>菜单与权限</span>
            <span class="section-badge">菜单 {{ form.menuIds.length }} · 权限 {{ form.permissionIds.length }}</span>
          </div>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="menu-tree-hint"
          >
            <template #default>
              勾选菜单项可分配菜单访问权，展开菜单节点可为该模块分配具体操作权限。
            </template>
          </el-alert>

          <div v-if="menuTree.length === 0" class="empty-hint">
            <el-icon :size="20"><WarningFilled /></el-icon>
            <span>暂无菜单数据，请先在"菜单管理"中添加菜单</span>
          </div>

          <div v-else class="menu-perm-list-wrapper">
            <div
              v-for="item in flatMenuPermList"
              :key="item.key"
              class="mp-row"
              :class="{ 'mp-row--menu': item.type === 'menu', 'mp-row--perm': item.type === 'perm' }"
              :style="{ paddingLeft: (12 + item.depth * 24) + 'px' }"
            >
              <!-- 菜单行 -->
              <template v-if="item.type === 'menu'">
                <el-checkbox
                  :model-value="form.menuIds.includes(item.menuId)"
                  size="small"
                  class="mp-checkbox"
                  @change="(val: boolean | string | number) => toggleMenu(item.menuId, !!val)"
                >
                  <span class="mp-menu-name">{{ item.name }}</span>
                </el-checkbox>
                <span v-if="item.path" class="mp-menu-path">{{ item.path }}</span>
              </template>
              <!-- 权限行 -->
              <template v-else>
                <el-checkbox
                  :model-value="form.permissionIds.includes(item.permId!)"
                  size="small"
                  class="mp-checkbox"
                  @change="(val: boolean | string | number) => togglePerm(item.permId!, !!val)"
                >
                  <span class="mp-perm-name">{{ item.name }}</span>
                </el-checkbox>
                <span class="mp-perm-action">{{ item.action }}</span>
              </template>
            </div>
          </div>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default">取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : (editingId ? '保存修改' : '创建角色') }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Plus, Edit, Delete, UserFilled, InfoFilled, Menu,
  User, Lock, Check, WarningFilled,
} from '@element-plus/icons-vue'
import {
  getRoles, createRole, updateRole, deleteRole, getAllPermissions, getMenuTree, getRole,
  type SystemRole
} from '@/api/system'

interface FlatItem {
  type: 'menu' | 'perm'
  key: string
  menuId: number
  permId?: number
  depth: number
  name: string
  path?: string
  action?: string
}

const roles = ref<SystemRole[]>([])
const permissionGroups = ref<{ resource: string; permissions: { id: number; name: string; action: string }[] }[]>([])
const menuTree = ref<any[]>([])
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
  name: '', code: '', description: '', status: true, permissionIds: [] as number[], menuIds: [] as number[]
}
const form = reactive<typeof defaultForm>({ ...defaultForm })

const rules: FormRules = {
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { min: 2, max: 30, message: '角色名称长度 2-30 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { min: 2, max: 30, message: '编码长度 2-30 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '编码必须以字母开头，只能包含字母、数字和下划线', trigger: 'blur' },
  ],
}

// 菜单路径 → 权限资源映射（路径末段 → resource）
const pathToResource: Record<string, string> = {
  users: 'user', roles: 'role', permissions: 'permission', menus: 'menu',
  tasks: 'task', files: 'file', analysis: 'analysis', llm: 'llm', rag: 'rag',
}

function getMenuResource(menu: any): string | null {
  if (!menu.path) return null
  const seg = menu.path.split('/').filter(Boolean).pop() || ''
  return pathToResource[seg] || null
}

function getPermsForMenu(menu: any): { id: number; name: string; action: string }[] {
  const resource = getMenuResource(menu)
  if (!resource) return []
  const group = permissionGroups.value.find(g => g.resource === resource)
  return group?.permissions || []
}

// 将菜单树展开为平面列表，权限行插入到对应菜单下方
const flatMenuPermList = computed<FlatItem[]>(() => {
  const result: FlatItem[] = []
  function walk(menus: any[], depth: number) {
    for (const m of menus) {
      result.push({
        type: 'menu',
        key: `menu-${m.id}`,
        menuId: m.id,
        depth,
        name: m.name,
        path: m.path || '',
      })
      const perms = getPermsForMenu(m)
      for (const p of perms) {
        result.push({
          type: 'perm',
          key: `perm-${p.id}`,
          menuId: m.id,
          permId: p.id,
          depth: depth + 1,
          name: p.name,
          action: p.action,
        })
      }
      if (m.children && m.children.length > 0) {
        walk(m.children, depth + 1)
      }
    }
  }
  walk(menuTree.value, 0)
  return result
})

function toggleMenu(menuId: number, checked: boolean) {
  if (checked) {
    if (!form.menuIds.includes(menuId)) form.menuIds.push(menuId)
  } else {
    form.menuIds = form.menuIds.filter(id => id !== menuId)
  }
}

function togglePerm(permId: number, checked: boolean) {
  if (checked) {
    if (!form.permissionIds.includes(permId)) form.permissionIds.push(permId)
  } else {
    form.permissionIds = form.permissionIds.filter(id => id !== permId)
  }
}

async function loadRoles() {
  loading.value = true
  try {
    const res: any = await getRoles({ page: currentPage.value, pageSize: pageSize.value, keyword: searchForm.keyword })
    if (res.success) { roles.value = res.data.list; total.value = res.data.total }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function loadPermissionGroups() {
  try {
    const res: any = await getAllPermissions()
    if (res.success) permissionGroups.value = res.data
  } catch { /* ignore */ }
}

async function loadMenuTree() {
  try {
    const res: any = await getMenuTree()
    if (res.success) menuTree.value = res.data
  } catch { /* ignore */ }
}

function handleSearch() { currentPage.value = 1; loadRoles() }
function handleReset() { searchForm.keyword = ''; currentPage.value = 1; loadRoles() }

function showAddDialog() {
  editingId.value = null
  Object.assign(form, { ...defaultForm })
  formRef.value?.resetFields()
  dialogVisible.value = true
}

async function editRole(row: SystemRole) {
  editingId.value = row.id!
  try {
    const res: any = await getRole(row.id!)
    if (res.success) {
      const data = res.data
      Object.assign(form, {
        name: data.name, code: data.code, description: data.description || '',
        status: data.status,
        permissionIds: data.permissionIds ? [...data.permissionIds] : [],
        menuIds: data.menuIds ? [...data.menuIds] : [],
      })
    }
  } catch {
    Object.assign(form, {
      name: row.name, code: row.code, description: row.description || '',
      status: row.status,
      permissionIds: row.permissionIds ? [...row.permissionIds] : [],
      menuIds: row.menuIds ? [...row.menuIds] : [],
    })
  }
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
        ? await updateRole(editingId.value, payload)
        : await createRole(payload)
      if (res.success) {
        ElMessage.success(editingId.value ? '角色信息已更新' : '角色创建成功')
        dialogVisible.value = false
        loadRoles()
      }
    } catch { /* ignore */ }
    finally { saving.value = false }
  })
}

async function handleDelete(row: SystemRole) {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色 "${row.name}" 吗？删除后不可恢复，关联该角色的用户将失去对应权限。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    const res: any = await deleteRole(row.id!)
    if (res.success) { ElMessage.success('角色已删除'); loadRoles() }
  } catch { /* cancelled */ }
}

async function handleStatusChange(row: SystemRole) {
  try {
    await updateRole(row.id!, { status: row.status } as any)
  } catch { row.status = !row.status }
}

onMounted(() => {
  loadRoles()
  loadPermissionGroups()
  loadMenuTree()
})
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
</style>

<style>
/* 复用 Users.vue 的全局样式，额外补充角色页特有样式 */
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
  max-height: 60vh;
  overflow-y: auto;
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

.section-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: #909399;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
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

/* 菜单-权限列表 */
.menu-tree-hint {
  margin-bottom: 12px;
  border-radius: 8px;
}

.menu-perm-list-wrapper {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 8px 0;
  max-height: 420px;
  overflow-y: auto;
}

/* 每一行 */
.mp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 16px;
  min-height: 34px;
  transition: background 0.15s;
}

.mp-row:hover {
  background: rgba(102, 126, 234, 0.03);
}

.mp-row--menu {
  font-weight: 500;
}

.mp-row--perm {
  border-top: 1px dashed #f0f0f0;
}

/* 复选框 */
.mp-checkbox {
  margin-right: 0 !important;
  height: auto;
}

.mp-checkbox .el-checkbox__label {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 菜单名称 */
.mp-menu-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

/* 菜单路径标签 */
.mp-menu-path {
  font-size: 11px;
  color: #909399;
  background: #eef0f4;
  padding: 1px 7px;
  border-radius: 4px;
  font-family: monospace;
  flex-shrink: 0;
}

/* 权限名称 */
.mp-perm-name {
  color: #4b5563;
  font-size: 12px;
}

/* 权限操作标签 */
.mp-perm-action {
  font-size: 10px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.08);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
  flex-shrink: 0;
}

/* 空状态提示 */
.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #909399;
  font-size: 13px;
  background: #fafbfc;
  border-radius: 10px;
  border: 1px dashed #e5e7eb;
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
