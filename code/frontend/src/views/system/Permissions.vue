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
            <el-tag size="small">{{ row.resource }}</el-tag>
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑权限' : '新增权限'"
      width="520px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" label-position="left">
        <el-form-item label="权限名称" required>
          <el-input v-model="form.name" placeholder="如: 查看用户" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="form.code" placeholder="如: user:view" />
        </el-form-item>
        <el-form-item label="资源" required>
          <el-select v-model="form.resource" placeholder="选择资源" style="width: 100%" filterable allow-create>
            <el-option label="用户 (user)" value="user" />
            <el-option label="角色 (role)" value="role" />
            <el-option label="权限 (permission)" value="permission" />
            <el-option label="菜单 (menu)" value="menu" />
            <el-option label="任务 (task)" value="task" />
            <el-option label="文件 (file)" value="file" />
            <el-option label="分析 (analysis)" value="analysis" />
            <el-option label="LLM (llm)" value="llm" />
            <el-option label="RAG (rag)" value="rag" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作" required>
          <el-select v-model="form.action" placeholder="选择操作" style="width: 100%" filterable allow-create>
            <el-option label="查看 (view)" value="view" />
            <el-option label="创建 (create)" value="create" />
            <el-option label="编辑 (edit)" value="edit" />
            <el-option label="删除 (delete)" value="delete" />
            <el-option label="管理 (manage)" value="manage" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述" />
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

const defaultForm = { name: '', code: '', resource: '', action: '', description: '' }
const form = reactive<typeof defaultForm>({ ...defaultForm })

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
  dialogVisible.value = true
}

function editPermission(row: SystemPermission) {
  editingId.value = row.id!
  Object.assign(form, {
    name: row.name, code: row.code, resource: row.resource, action: row.action,
    description: row.description || '',
  })
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name || !form.code || !form.resource || !form.action) {
    ElMessage.warning('请填写必填项'); return
  }

  saving.value = true
  try {
    const payload = { ...form }
    const res: any = editingId.value
      ? await updatePermission(editingId.value, payload)
      : await createPermission(payload)
    if (res.success) {
      ElMessage.success(editingId.value ? '权限更新成功' : '权限创建成功')
      dialogVisible.value = false
      loadPermissions()
    }
  } catch { /* ignore */ }
  finally { saving.value = false }
}

async function handleDelete(row: SystemPermission) {
  try {
    await ElMessageBox.confirm(`确定要删除权限 "${row.name}" 吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
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
