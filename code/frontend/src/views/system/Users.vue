<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="用户名/姓名/邮箱" clearable style="width: 220px" @keyup.enter="handleSearch" />
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

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑用户' : '新增用户'"
      width="520px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" label-position="left">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item :label="editingId ? '新密码' : '密码'" :required="!editingId">
          <el-input v-model="form.password" type="password" show-password :placeholder="editingId ? '留空则不修改密码' : '请输入密码（至少6位）'" />
        </el-form-item>
        <el-form-item label="真实姓名" required>
          <el-input v-model="form.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple placeholder="请选择角色" style="width: 100%">
            <el-option v-for="r in allRoles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" active-text="启用" inactive-text="禁用" />
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

const defaultForm = {
  username: '', password: '', realName: '', email: '', phone: '', roleIds: [] as number[], status: true
}
const form = reactive<typeof defaultForm>({ ...defaultForm })

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
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.username || !form.realName) { ElMessage.warning('请填写用户名和真实姓名'); return }
  if (!editingId.value && !form.password) { ElMessage.warning('请输入密码'); return }
  if (!editingId.value && form.password.length < 6) { ElMessage.warning('密码长度不能少于6位'); return }

  saving.value = true
  try {
    const payload: any = { ...form, password: form.password || undefined }
    const res: any = editingId.value
      ? await updateUser(editingId.value, payload)
      : await createUser(payload as any)
    if (res.success) {
      ElMessage.success(editingId.value ? '用户更新成功' : '用户创建成功')
      dialogVisible.value = false
      loadUsers()
    }
  } catch { /* handled by interceptor */ }
  finally { saving.value = false }
}

async function handleDelete(row: SystemUser) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 "${row.username}" 吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
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
