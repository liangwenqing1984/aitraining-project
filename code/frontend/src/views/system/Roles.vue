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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑角色' : '新增角色'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" label-position="left">
        <el-form-item label="角色名称" required>
          <el-input v-model="form.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="form.code" placeholder="如: admin, operator" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
        </el-form-item>
        <el-form-item label="权限分配">
          <div v-if="permissionGroups.length === 0" class="text-muted">暂无权限数据</div>
          <div v-for="group in permissionGroups" :key="group.resource" class="perm-group">
            <div class="perm-group-title">{{ group.resource }}</div>
            <el-checkbox-group v-model="form.permissionIds">
              <el-checkbox v-for="perm in group.permissions" :key="perm.id" :value="perm.id" :label="perm.id">
                {{ perm.name }} <span class="perm-code">({{ perm.action }})</span>
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </el-form-item>
        <el-form-item label="菜单分配">
          <el-tree
            ref="menuTreeRef"
            :data="menuTree"
            show-checkbox
            node-key="id"
            :default-checked-keys="form.menuIds"
            :props="{ label: 'name', children: 'children' }"
            @check="onMenuCheck"
          />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import {
  getRoles, createRole, updateRole, deleteRole, getAllPermissions, getMenuTree, getRole,
  type SystemRole
} from '@/api/system'

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
const menuTreeRef = ref<any>(null)

const defaultForm = {
  name: '', code: '', description: '', status: true, permissionIds: [] as number[], menuIds: [] as number[]
}
const form = reactive<typeof defaultForm>({ ...defaultForm })

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
  dialogVisible.value = true
}

function onMenuCheck(_node: any, checked: any) {
  form.menuIds = checked.checkedKeys
}

async function handleSave() {
  if (!form.name || !form.code) { ElMessage.warning('请填写角色名称和编码'); return }

  saving.value = true
  try {
    const payload = { ...form }
    const res: any = editingId.value
      ? await updateRole(editingId.value, payload)
      : await createRole(payload)
    if (res.success) {
      ElMessage.success(editingId.value ? '角色更新成功' : '角色创建成功')
      dialogVisible.value = false
      loadRoles()
    }
  } catch { /* ignore */ }
  finally { saving.value = false }
}

async function handleDelete(row: SystemRole) {
  try {
    await ElMessageBox.confirm(`确定要删除角色 "${row.name}" 吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
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
.text-muted { color: #c0c4cc; font-size: 13px; }
.perm-group { margin-bottom: 12px; }
.perm-group-title { font-weight: 600; color: #303133; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid #ebeef5; padding-bottom: 4px; }
.perm-code { color: #909399; font-size: 11px; margin-left: 2px; }
</style>
