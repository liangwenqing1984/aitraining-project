<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fileApi, type CsvFile } from '@/api/file'
import { ElMessage, ElMessageBox } from 'element-plus'

const files = ref<CsvFile[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchKeyword = ref('')
const searchSource = ref('')
const dateRange = ref<[Date, Date]>()
const selectedFiles = ref<string[]>([])
const previewVisible = ref(false)
const previewData = ref<any[]>([])
const previewFile = ref<CsvFile | null>(null)

// 🔧 安全的时间格式化函数
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  
  try {
    const date = new Date(dateStr)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('[FormatDateTime] Invalid date:', dateStr)
      return '-'
    }
    
    // 格式化为本地时间字符串
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('[FormatDateTime] Error formatting date:', error, dateStr)
    return '-'
  }
}

// 计算预览表格列
const previewColumns = computed(() => {
  if (previewData.value.length === 0) return []

  const columns = Object.keys(previewData.value[0]).map(key => ({
    prop: key,
    label: key,
    width: 120
  }))

  // 添加常用列的固定宽度
  const fixedWidthColumns = ['职位名称', '公司名称', '薪资', '工作地点', '发布时间']
  columns.forEach(column => {
    if (fixedWidthColumns.includes(column.label)) {
      column.width = 150
    }
  })

  return columns
})

onMounted(() => {
  loadFiles()
})

async function loadFiles() {
  try {
    // 🔧 修复: 传递搜索参数给后端API
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    
    // 添加文件名搜索条件
    if (searchKeyword.value && searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim()
    }
    
    // 添加数据来源筛选条件
    if (searchSource.value) {
      params.source = searchSource.value
    }
    
    console.log('[Files] Search params:', params)
    
    const res: any = await fileApi.getFiles(params)
    
    console.log('[Files] API response:', res)
    
    // 确保数据结构正确
    if (res.success && res.data && Array.isArray(res.data.list)) {
      files.value = res.data.list
      total.value = res.data.total || 0
      console.log('[Files] Loaded', files.value.length, 'files')
    } else {
      console.warn('[Files] Invalid data format, using empty array')
      files.value = []
      total.value = 0
      ElMessage.warning('数据格式异常')
    }
  } catch (error) {
    console.error('[Files] Load files error:', error)
    files.value = []
    total.value = 0
    ElMessage.error('加载文件列表失败')
  }
}

function handleSelectionChange(selection: CsvFile[]) {
  selectedFiles.value = selection.map(f => f.id)
}

function formatSize(size: number): string {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  return (size / (1024 * 1024)).toFixed(2) + ' MB'
}

function getSourceName(source: string): string {
  return source === 'zhilian' ? '智联招聘' : source === '51job' ? '前程无忧' : source
}

async function downloadFile(file: CsvFile) {
  try {
    const blobRes: any = await fileApi.downloadFile(file.id)
    // 🔧 修复：blobRes已经是Blob对象，直接使用
    const url = window.URL.createObjectURL(blobRes)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', file.filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('文件下载成功')
  } catch (error: any) {
    console.error('[Download] Error:', error)
    ElMessage.error(error.response?.data?.error || '下载失败')
  }
}

async function preview(file: CsvFile) {
  try {
    const res: any = await fileApi.previewFile(file.id, 10)
    
    console.log('[Preview] API response:', res)
    
    if (res.success && res.data) {
      // 🔧 修复: 将后端的 { headers, rows } 格式转换为对象数组
      const { headers, rows } = res.data
      
      if (!headers || !rows || rows.length === 0) {
        ElMessage.warning('文件内容为空')
        return
      }
      
      // 转换为对象数组格式: [{ header1: value1, header2: value2 }, ...]
      previewData.value = rows.map((row: string[]) => {
        const obj: any = {}
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || ''
        })
        return obj
      })
      
      console.log('[Preview] Converted data:', previewData.value)
      
      previewFile.value = file
      previewVisible.value = true
    } else {
      ElMessage.warning('暂无预览数据')
    }
  } catch (error) {
    console.error('[Preview] Error:', error)
    ElMessage.error('预览失败')
  }
}

async function deleteFile(file: CsvFile) {
  await ElMessageBox.confirm('确定要删除此文件吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })

  const res: any = await fileApi.deleteFile(file.id)
  if (res.success) {
    ElMessage.success('删除成功')
    loadFiles()
  }
}

async function batchDelete() {
  if (!selectedFiles.value.length) {
    ElMessage.warning('请先选择要删除的文件')
    return
  }

  await ElMessageBox.confirm(`确定要删除选中的 ${selectedFiles.value.length} 个文件吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })

  const res: any = await fileApi.batchDelete(selectedFiles.value)
  if (res.success) {
    ElMessage.success(res.message)
    selectedFiles.value = []
    loadFiles()
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadFiles()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  loadFiles()
}
</script>

<template>
  <div class="files-page">
    <el-card class="search-card">
      <el-form :inline="true">
        <el-form-item label="文件名">
          <el-input
            v-model="searchKeyword"
            placeholder="输入文件名搜索"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="数据来源">
          <el-select v-model="searchSource" placeholder="全部来源" clearable style="width: 150px">
            <el-option label="智联招聘" value="zhilian" />
            <el-option label="前程无忧" value="51job" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadFiles">搜索</el-button>
          <el-button
            type="danger"
            :disabled="!selectedFiles.length"
            @click="batchDelete"
          >
            批量删除
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table
        :data="files"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="filename" label="文件名" min-width="200" />
        <el-table-column prop="source" label="数据来源" width="120">
          <template #default="{ row }">
            <el-tag>{{ getSourceName(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录数" width="100" />
        <el-table-column label="文件大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="preview(row)">
              预览
            </el-button>
            <el-button type="primary" link @click="downloadFile(row)">
              下载
            </el-button>
            <el-button type="danger" link @click="deleteFile(row)">
              删除
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
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
        style="margin-top: 16px; justify-content: flex-end; display: flex;"
      />
    </el-card>

    <!-- 文件预览模态框 -->
    <el-dialog
      v-model="previewVisible"
      title="文件预览"
      width="80%"
      :before-close="() => previewVisible = false"
    >
      <el-table
        v-if="previewData.length > 0"
        :data="previewData"
        stripe
        style="width: 100%"
      >
        <el-table-column
          v-for="column in previewColumns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
        />
      </el-table>
      <div v-else class="preview-empty">
        暂无数据
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.files-page {
  padding: 0;
}

.search-card {
  margin-bottom: 16px;
}

.preview-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
}
</style>
