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
        <el-table-column prop="icon" label="图标" width="100">
          <template #default="{ row }">
            <span v-if="row.icon">{{ row.icon }}</span>
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      width="540px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" label-position="left">
        <el-form-item label="菜单名称" required>
          <el-input v-model="form.name" placeholder="如: 首页" />
        </el-form-item>
        <el-form-item label="路径">
          <el-input v-model="form.path" placeholder="如: /home" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="Element Plus 图标名, 如: HomeFilled" />
        </el-form-item>
        <el-form-item label="组件路径">
          <el-input v-model="form.component" placeholder="如: views/Home.vue (可为空)" />
        </el-form-item>
        <el-form-item label="上级菜单">
          <el-tree-select
            v-model="form.parentId"
            :data="menuTreeForSelect"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            placeholder="无（顶级菜单）"
            clearable
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999" style="width: 120px" />
        </el-form-item>
        <el-form-item label="是否隐藏">
          <el-switch v-model="form.hidden" active-text="隐藏" inactive-text="可见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh } from '@element-plus/icons-vue'
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

// 树形选择数据（过滤掉自己和后代避免循环引用）
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

async function loadMenus() {
  loading.value = true
  try {
    const res: any = await getMenus({ pageSize: 200 })
    if (res.success) {
      // 构建 tree 显示
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
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name) { ElMessage.warning('请填写菜单名称'); return }

  saving.value = true
  try {
    const payload = { ...form, parentId: form.parentId || undefined }
    const res: any = editingId.value
      ? await updateMenu(editingId.value, payload)
      : await createMenu(payload)
    if (res.success) {
      ElMessage.success(editingId.value ? '菜单更新成功' : '菜单创建成功')
      dialogVisible.value = false
      loadMenus()
    }
  } catch { /* ignore */ }
  finally { saving.value = false }
}

async function handleDelete(row: SystemMenu) {
  try {
    await ElMessageBox.confirm(`确定要删除菜单 "${row.name}" 吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
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
</style>
