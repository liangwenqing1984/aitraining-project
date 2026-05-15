<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true">
        <el-form-item>
          <el-button type="primary" @click="showAddDialog(null)">
            <el-icon><Plus /></el-icon>新增菜单
          </el-button>
          <el-button @click="loadMenus">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="menus" stripe v-loading="loading" row-key="id" :tree-props="{ children: 'children', hasChildren: 'hasChildren' }" default-expand-all>
        <el-table-column prop="name" label="菜单名称" width="200" />
        <el-table-column prop="path" label="路径" width="180" show-overflow-tooltip />
        <el-table-column prop="icon" label="图标" width="120">
          <template #default="{ row }">
            <span v-if="row.icon" class="icon-tag">
              <code>{{ row.icon }}</code>
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="component" label="组件" width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.component">{{ row.component }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
        <el-table-column label="可见" width="60" align="center">
          <template #default="{ row }">
            <el-tag :type="row.hidden ? 'info' : 'success'" size="small">{{ row.hidden ? '隐藏' : '可见' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showAddDialog(row)">
              <el-icon><Plus /></el-icon>新增子项
            </el-button>
            <el-button link type="primary" size="small" @click="editMenu(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      width="680px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><Menu /></el-icon>
          </span>
          <span>{{ editingId ? '编辑菜单' : '新增菜单' }}</span>
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

          <el-form-item label="菜单名称" prop="name">
            <el-input v-model="form.name" placeholder="如: 首页、数据采集" :prefix-icon="EditPen" />
          </el-form-item>

          <el-form-item label="路径" prop="path">
            <el-input v-model="form.path" placeholder="如: /home、/crawler" :prefix-icon="Link" />
            <div class="field-hint">前端路由路径，顶级菜单必填，父级菜单可为空</div>
          </el-form-item>

          <el-form-item label="图标" prop="icon">
            <el-input v-model="form.icon" placeholder="Element Plus 图标名" :prefix-icon="Picture" />
            <div class="field-hint">
              填写 Element Plus 图标组件名，如 HomeFilled、Setting。
              <a href="https://element-plus.org/zh-CN/component/icon.html" target="_blank" class="icon-link">查看图标库</a>
            </div>
          </el-form-item>

          <el-form-item label="上级菜单" prop="parentId">
            <el-tree-select
              v-model="form.parentId"
              :data="menuTreeForSelect"
              :props="{ label: 'name', value: 'id', children: 'children' }"
              placeholder="无（顶级菜单）"
              clearable
              check-strictly
              style="width: 100%"
            />
            <div class="field-hint">选择上级菜单后，当前菜单将作为其子菜单显示</div>
          </el-form-item>

          <el-form-item label="组件路径" prop="component">
            <el-input v-model="form.component" placeholder="如: views/Home.vue（可为空）" :prefix-icon="Document" />
          </el-form-item>
        </div>

        <el-divider margin="20px 0" />

        <!-- 显示设置 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><Setting /></el-icon></span>
            <span>显示设置</span>
          </div>

          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="排序" prop="sortOrder">
                <el-input-number v-model="form.sortOrder" :min="0" :max="999" style="width: 100%" />
                <div class="field-hint">数值越小越靠前</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="可见性">
                <div class="visibility-toggle">
                  <el-switch
                    v-model="form.hidden"
                    active-text="隐藏"
                    inactive-text="可见"
                    inline-prompt
                    style="--el-switch-on-color: #909399; --el-switch-off-color: #13ce66"
                  />
                </div>
                <div class="field-hint">{{ form.hidden ? '菜单不在侧边栏显示' : '菜单在侧边栏正常显示' }}</div>
              </el-form-item>
            </el-col>
          </el-row>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default"><el-icon><Close /></el-icon>取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : (editingId ? '保存修改' : '创建菜单') }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Plus, Edit, Delete, Refresh, Menu, InfoFilled, Setting,
  EditPen, Link, Picture, Document, Check, Close,
} from '@element-plus/icons-vue'
import {
  getMenus, getMenuTree, createMenu, updateMenu, deleteMenu,
  type SystemMenu
} from '@/api/system'

const menus = ref<SystemMenu[]>([])
const menuTreeData = ref<SystemMenu[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const menuTreeForSelect = computed(() => {
  if (!editingId.value) return menuTreeData.value
  function filterSelfAndDescendants(tree: SystemMenu[]): SystemMenu[] {
    return tree
      .filter(node => node.id !== editingId.value)
      .map(node => ({
        ...node,
        children: filterSelfAndDescendants(node.children || []),
      }))
  }
  return filterSelfAndDescendants(menuTreeData.value)
})

const defaultForm = {
  name: '', path: '', icon: '', component: '', parentId: null as number | null, sortOrder: 0, hidden: false
}
const form = reactive<typeof defaultForm>({ ...defaultForm })

const rules: FormRules = {
  name: [
    { required: true, message: '请输入菜单名称', trigger: 'blur' },
    { min: 1, max: 20, message: '菜单名称长度 1-20 个字符', trigger: 'blur' },
  ],
  path: [
    { pattern: /^\/[a-zA-Z0-9/_-]*$/, message: '路径格式不正确，应以 / 开头', trigger: 'blur' },
  ],
  icon: [
    { max: 30, message: '图标名称过长', trigger: 'blur' },
  ],
}

async function loadMenus() {
  loading.value = true
  try {
    const res: any = await getMenus({ pageSize: 200 })
    if (res.success) {
      const list = res.data.list as SystemMenu[]
      menus.value = buildTree(list, null)
    }
    const treeRes: any = await getMenuTree()
    if (treeRes.success) menuTreeData.value = treeRes.data
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function buildTree(list: SystemMenu[], parentId: number | null): SystemMenu[] {
  return list
    .filter(m => (m.parentId ?? null) === parentId)
    .map(m => ({ ...m, children: buildTree(list, m.id!) }))
}

function showAddDialog(parent?: SystemMenu | null) {
  editingId.value = null
  Object.assign(form, {
    ...defaultForm,
    parentId: parent?.id ?? null,
    sortOrder: parent ? (parent.children?.length || 0) : 0,
  })
  formRef.value?.resetFields()
  dialogVisible.value = true
}

async function editMenu(row: SystemMenu) {
  editingId.value = row.id!
  Object.assign(form, {
    name: row.name,
    path: row.path || '',
    icon: row.icon || '',
    component: row.component || '',
    parentId: row.parentId ?? null,
    sortOrder: row.sortOrder ?? 0,
    hidden: row.hidden ?? false,
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
      const payload = { ...form, parentId: form.parentId || undefined }
      const res: any = editingId.value
        ? await updateMenu(editingId.value, payload)
        : await createMenu(payload)
      if (!res.success && res.error) {
        ElMessage.warning(res.error)
      } else if (res.success) {
        ElMessage.success(editingId.value ? '菜单信息已更新' : '菜单创建成功')
        dialogVisible.value = false
        loadMenus()
      }
    } catch { /* ignore */ }
    finally { saving.value = false }
  })
}

async function handleDelete(row: SystemMenu) {
  try {
    await ElMessageBox.confirm(
      `确定要删除菜单 "${row.name}" 吗？若存在子菜单将无法删除。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    const res: any = await deleteMenu(row.id!)
    if (!res.success && res.error) {
      ElMessage.warning(res.error)
    } else if (res.success) {
      ElMessage.success('菜单已删除')
      loadMenus()
    }
  } catch { /* cancelled */ }
}

onMounted(() => { loadMenus() })
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.text-muted { color: #c0c4cc; }
.icon-tag code {
  background: rgba(102, 126, 234, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.12);
}
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

.field-hint .icon-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.field-hint .icon-link:hover {
  text-decoration: underline;
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

/* 可见性开关 */
.visibility-toggle {
  margin-top: 2px;
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
