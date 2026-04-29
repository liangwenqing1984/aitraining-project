import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import { taskApi, type Task, type TaskConfig } from '@/api/task'
import { ElMessage } from 'element-plus'

export const useCrawlerStore = defineStore('crawler', () => {
  const socket = ref<Socket | null>(null)
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const isConnected = ref(false)
  
  // 🔧 新增：WebSocket重连状态管理
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const isManualDisconnect = ref(false)  // 标记是否为用户手动断开
  
  // 🔧 修复: 使用Map存储每个任务的独立日志,而不是全局共享数组
  const taskLogs = ref<Map<string, Array<{ time: string; level: string; message: string }>>>(new Map())
  
  // 兼容旧代码: 提供一个计算属性返回当前任务的日志
  // 🔧 关键修复: 直接返回Map中的数组引用，而不是创建新数组
  const logs = computed(() => {
    if (!currentTask.value?.id) return []
    const taskLogList = taskLogs.value.get(currentTask.value.id)
    // 如果不存在，初始化一个空数组并放入Map
    if (!taskLogList) {
      const newLogs: Array<{ time: string; level: string; message: string }> = []
      taskLogs.value.set(currentTask.value.id, newLogs)
      return newLogs
    }
    return taskLogList
  })

  // 计算属性
  const runningTasks = computed(() =>
    Array.isArray(tasks.value) 
      ? tasks.value.filter(t => t.status === 'running' || t.status === 'paused')
      : []
  )

  const statistics = computed(() => ({
    total: Array.isArray(tasks.value) ? tasks.value.length : 0,
    running: Array.isArray(tasks.value) ? tasks.value.filter(t => t.status === 'running').length : 0,
    completed: Array.isArray(tasks.value) ? tasks.value.filter(t => t.status === 'completed').length : 0,
    records: Array.isArray(tasks.value) ? tasks.value.reduce((sum, t) => sum + (t.recordCount || 0), 0) : 0
  }))

  // 🔧 新增：重新订阅所有运行中的任务
  function resubscribeRunningTasks() {
    if (!socket.value || !socket.value.connected) return
    
    const runningTaskIds = tasks.value
      .filter(t => t.status === 'running' || t.status === 'paused')
      .map(t => t.id)
    
    if (runningTaskIds.length > 0) {
      console.log(`[WebSocket] 🔄 重新订阅 ${runningTaskIds.length} 个运行中的任务`)
      runningTaskIds.forEach(taskId => {
        socket.value?.emit('task:subscribe', { taskId })
      })
    }
  }

  // 连接WebSocket
  function connectSocket() {
    if (socket.value?.connected) return

    console.log('[WebSocket] 🚀 正在建立连接...')
    
    socket.value = io('http://localhost:3004', {
      transports: ['websocket'],
      reconnection: true,           // 🔧 启用自动重连
      reconnectionDelay: 1000,      // 初始重连延迟1秒
      reconnectionDelayMax: 5000,   // 最大重连延迟5秒
      reconnectionAttempts: 0       // 无限重试（我们手动控制）
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      reconnectAttempts.value = 0  // 重置重连计数
      isManualDisconnect.value = false
      console.log('[WebSocket] ✅ 连接成功')
      
      // 🔧 关键：连接成功后重新订阅所有运行中的任务
      resubscribeRunningTasks()
      
      ElMessage.success({
        message: '实时连接已恢复',
        duration: 2000
      })
    })

    socket.value.on('disconnect', (reason) => {
      isConnected.value = false
      console.warn('[WebSocket] ⚠️ 连接断开:', reason)
      
      // 如果不是手动断开，显示提示
      if (!isManualDisconnect.value) {
        ElMessage.warning({
          message: `连接已断开 (${reason})，正在尝试重连...`,
          duration: 3000
        })
      }
    })

    // 🔧 新增：监听重连事件
    socket.value.on('reconnect', (attemptNumber) => {
      console.log(`[WebSocket] 🔄 重连成功 (第${attemptNumber}次尝试)`)
      reconnectAttempts.value = 0
    })

    socket.value.on('reconnect_attempt', (attemptNumber) => {
      reconnectAttempts.value = attemptNumber
      console.log(`[WebSocket] 🔄 尝试重连... (${attemptNumber}/${maxReconnectAttempts})`)
    })

    socket.value.on('reconnect_error', (error) => {
      console.error('[WebSocket] ❌ 重连失败:', error.message)
      
      if (reconnectAttempts.value >= maxReconnectAttempts) {
        ElMessage.error({
          message: '重连失败次数过多，请检查网络连接或刷新页面',
          duration: 5000
        })
      }
    })

    socket.value.on('reconnect_failed', () => {
      console.error('[WebSocket] ❌ 重连失败，已达最大尝试次数')
      ElMessage.error({
        message: '无法连接到服务器，请检查后端服务是否正常运行',
        duration: 0,  // 不自动关闭
        showClose: true
      })
    })

    socket.value.on('task:progress', (data: any) => {
      updateTaskProgress(data.taskId, data)
    })

    socket.value.on('task:status', (data: any) => {
      // 更新任务状态
      const task = tasks.value.find(t => t.id === data.taskId)
      if (task) {
        task.status = data.status
        // 🔧 修复: 只在当前任务是此任务时才添加日志
        if (currentTask.value?.id === data.taskId && data.message) {
          addLogToTask(data.taskId, 'info', data.message)
        }
      }
      // 如果当前任务就是这个任务,也更新
      if (currentTask.value && currentTask.value.id === data.taskId) {
        currentTask.value.status = data.status
        console.log('[Store] 收到状态更新:', data.status)
      }
    })

    socket.value.on('task:completed', (data: any) => {
      updateTaskCompleted(data.taskId, data)
      // 🔧 修复: 只在当前任务是此任务时才添加日志
      if (currentTask.value?.id === data.taskId) {
        addLogToTask(data.taskId, 'success', `任务完成，共采集 ${data.totalRecords} 条数据`)
      }
    })

    socket.value.on('task:error', (data: any) => {
      updateTaskError(data.taskId, data.error, data.recordCount)
      if (currentTask.value?.id === data.taskId) {
        addLogToTask(data.taskId, 'error', data.error)
      }
    })

    socket.value.on('task:failed', (data: any) => {
      updateTaskError(data.taskId, data.error, data.recordCount)
      if (currentTask.value?.id === data.taskId) {
        addLogToTask(data.taskId, 'error', `任务失败: ${data.error}`)
      }
    })

    socket.value.on('task:stopped', (data: any) => {
      updateTaskStopped(data.taskId, data)
      if (currentTask.value?.id === data.taskId) {
        addLogToTask(data.taskId, 'info', `任务已停止，共采集 ${data.totalRecords || 0} 条数据`)
      }
    })

    // 监听 AI 增强进度
    socket.value.on('enrichment:progress', (data: any) => {
      const { taskId, status, message } = data
      if (status === 'completed') {
        ElMessage.success(`[AI 增强] ${message}`)
      } else if (status === 'failed') {
        ElMessage.error(`[AI 增强] ${message}`)
      }
      // Also log to task
      if (taskId) {
        addLogToTask(taskId, status === 'failed' ? 'error' : 'info', `[AI增强] ${message}`)
      }
    })

    // 🔧 关键修复: task:log事件需要根据taskId路由到对应的任务日志
    socket.value.on('task:log', (data: any) => {
      // data应该包含: { taskId, level, message }
      if (data.taskId) {
        addLogToTask(data.taskId, data.level || 'info', data.message)
      } else {
        // 兼容旧格式: 如果没有taskId,添加到当前任务
        if (currentTask.value?.id) {
          addLogToTask(currentTask.value.id, data.level || 'info', data.message)
        }
      }
    })
  }

  // 断开连接
  function disconnectSocket() {
    isManualDisconnect.value = true  // 标记为手动断开
    socket.value?.disconnect()
    socket.value = null
    isConnected.value = false
    console.log('[WebSocket] 🔌 手动断开连接')
  }

  // 订阅任务
  function subscribeTask(taskId: string) {
    socket.value?.emit('task:subscribe', { taskId })
  }

  // 取消订阅
  function unsubscribeTask(taskId: string) {
    socket.value?.emit('task:unsubscribe', { taskId })
  }

  // 创建任务
  async function createTask(config: TaskConfig) {
    try {
      console.log('[Store] 开始创建任务, 配置:', JSON.stringify(config, null, 2))
      
      const res = await taskApi.createTask(config)
      console.log('[Store] Create task API response:', res)
      
      // 拦截器已经返回了 response.data，即后端的完整响应体 { success, data, error }
      if (res.success && res.data?.taskId) {
        console.log('[Store] 任务创建成功, taskId:', res.data.taskId)
        
        // 重新加载任务列表
        await loadTasks()
        
        // 订阅任务更新
        subscribeTask(res.data.taskId)
        
        // 设置当前任务 - 确保 tasks.value 是数组
        currentTask.value = Array.isArray(tasks.value) 
          ? tasks.value.find(t => t.id === res.data!.taskId) || null 
          : null
        
        // 🔧 初始化该任务的日志数组
        if (currentTask.value?.id) {
          taskLogs.value.set(currentTask.value.id, [])
        }
        
        console.log('[Store] 当前任务已设置:', currentTask.value?.id)
      } else {
        console.warn('[Store] 任务创建响应异常:', res)
      }
      
      return res
    } catch (error: any) {
      console.error('[Store] ❌ Create task error:', error)
      
      // 提取更有用的错误信息
      if (error.response) {
        // 服务器返回了错误响应
        console.error('[Store] 服务器错误响应:', error.response.data)
        throw new Error(error.response.data?.error || error.response.data?.message || '服务器错误')
      } else if (error.request) {
        // 请求已发出但没有收到响应
        console.error('[Store] 无响应:', error.request)
        throw new Error('无法连接到服务器，请检查后端服务是否运行')
      } else {
        // 其他错误
        throw error
      }
    }
  }

  // 开始任务
  async function startTask(taskId: string) {
    try {
      const res = await taskApi.startTask(taskId)
      
      if (res.success) {
        ElMessage.success('任务已启动')
        // 重新加载任务列表
        await loadTasks()
        // 订阅任务更新
        subscribeTask(taskId)
        // 强制更新当前任务 - 确保 tasks.value 是数组
        currentTask.value = Array.isArray(tasks.value) 
          ? tasks.value.find(t => t.id === taskId) || null 
          : null
        
        // 🔧 确保该任务有日志数组
        if (!taskLogs.value.has(taskId)) {
          taskLogs.value.set(taskId, [])
        }
        
        // 如果当前就在监控页面，确保显示正确的状态
        if (currentTask.value) {
          console.log('[Store] 任务启动后状态:', currentTask.value.status, '进度:', currentTask.value.progress)
        }
      } else {
        ElMessage.error(res.error || '启动失败')
      }
      return res
    } catch (error: any) {
      console.error('Start task error:', error)
      ElMessage.error(error.message || '启动失败')
      throw error
    }
  }

  // 加载任务列表
  async function loadTasks() {
    try {
      const res = await taskApi.getTasks()
      console.log('[Store] Load tasks API response:', res)
      
      // 拦截器已经返回了 response.data，即后端的完整响应体 { success, data, error }
      if (res.success && res.data && Array.isArray(res.data.list)) {
        tasks.value = res.data.list
        console.log('[Store] Tasks loaded:', tasks.value.length)
      } else {
        console.warn('[Store] Invalid tasks data format:', res)
        tasks.value = [] // 确保是数组
      }
    } catch (error) {
      console.error('[Store] Load tasks error:', error)
      tasks.value = [] // 出错时确保是空数组
    }
  }

  // 停止任务
  async function stopTask(taskId: string) {
    try {
      await taskApi.stopTask(taskId)
      updateTaskStatus(taskId, 'stopped')
      ElMessage.success('任务已停止')
    } catch (error) {
      console.error('[Store] Stop task error:', error)
      ElMessage.error('停止任务失败')
    }
  }

  // 暂停任务
  async function pauseTask(taskId: string) {
    try {
      await taskApi.pauseTask(taskId)
      updateTaskStatus(taskId, 'paused')
      ElMessage.success('任务已暂停')
    } catch (error) {
      console.error('[Store] Pause task error:', error)
      ElMessage.error('暂停任务失败')
    }
  }

  // 恢复任务
  async function resumeTask(taskId: string) {
    try {
      await taskApi.resumeTask(taskId)
      updateTaskStatus(taskId, 'running')
      ElMessage.success('任务已恢复')
    } catch (error) {
      console.error('[Store] Resume task error:', error)
      ElMessage.error('恢复任务失败')
    }
  }

  // 删除任务
  async function deleteTask(taskId: string) {
    try {
      const res = await taskApi.deleteTask(taskId)
      if (res.success) {
        ElMessage.success('任务已删除')
        await loadTasks() // 重新加载列表确保同步
        if (currentTask.value?.id === taskId) {
          currentTask.value = null
        }
        // 🔧 清理该任务的日志
        taskLogs.value.delete(taskId)
      } else {
        ElMessage.error(res.error || '删除失败')
      }
    } catch (error: any) {
      console.error('[Store] Delete task error:', error)
      ElMessage.error('删除任务失败')
    }
  }

  // 🔧 更新任务配置（不启动任务）
  async function updateTaskConfig(taskId: string, config: TaskConfig) {
    try {
      const res = await taskApi.updateTaskConfig(taskId, config)
      if (res.success) {
        ElMessage.success(res.message || '任务配置已保存')
        // 重新加载任务列表以获取最新信息
        await loadTasks()
        // 如果当前正在查看该任务，更新当前任务信息
        if (currentTask.value?.id === taskId) {
          const updatedTask = await taskApi.getTask(taskId)
          if (updatedTask.success && updatedTask.data) {
            currentTask.value = updatedTask.data
          }
        }
      } else {
        ElMessage.error(res.error || '保存配置失败')
      }
    } catch (error: any) {
      console.error('[Store] Update task config error:', error)
      throw error
    }
  }

  // 更新任务进度
  function updateTaskProgress(taskId: string, data: any) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.progress = data.progress
      task.comboProgress = data.comboProgress || 0
      task.comboRecords = data.comboRecords || 0
      task.current = data.current
      task.recordCount = data.recordCount
    }
    if (currentTask.value?.id === taskId) {
      Object.assign(currentTask.value, {
        progress: data.progress,
        comboProgress: data.comboProgress || 0,
        comboRecords: data.comboRecords || 0,
        current: data.current,
        recordCount: data.recordCount
      })
    }
  }

  // 更新任务状态
  function updateTaskStatus(taskId: string, status: string, message?: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = status as any
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = status as any
    }
    // 🔧 修复: 只在当前任务是此任务时才添加日志
    if (message && currentTask.value?.id === taskId) {
      addLogToTask(taskId, 'info', message)
    }
  }

  // 任务完成
  function updateTaskCompleted(taskId: string, data: any) {
    console.log('[Store] 收到任务完成事件:', taskId, data)
    
    // 更新列表中的任务
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = 'completed'
      task.progress = 100
      task.current = data.totalRecords
      task.recordCount = data.totalRecords
      task.endTime = new Date().toISOString()
      console.log('[Store] 已更新列表中的任务状态为 completed')
    }
    
    // 同步更新 currentTask
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = 'completed'
      currentTask.value.progress = 100
      currentTask.value.current = data.totalRecords
      currentTask.value.recordCount = data.totalRecords
      currentTask.value.endTime = new Date().toISOString()
      console.log('[Store] 已更新 currentTask 状态为 completed')
    }
  }

  // 任务停止（保持真实进度，不设100%）
  function updateTaskStopped(taskId: string, data: any) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = 'stopped'
      // 保持停止时的真实进度，不覆盖为100%
      if (data.progress !== undefined) {
        task.progress = data.progress
      }
      if (data.current !== undefined) {
        task.current = data.current
      }
      if (data.totalRecords !== undefined) {
        task.recordCount = data.totalRecords
      }
      task.endTime = new Date().toISOString()
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = 'stopped'
      if (data.progress !== undefined) {
        currentTask.value.progress = data.progress
      }
      if (data.current !== undefined) {
        currentTask.value.current = data.current
      }
      if (data.totalRecords !== undefined) {
        currentTask.value.recordCount = data.totalRecords
      }
      currentTask.value.endTime = new Date().toISOString()
    }
  }

  // 任务错误
  function updateTaskError(taskId: string, error: string, recordCount?: number) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = 'failed'
      task.errorMessage = error
      if (recordCount !== undefined) {
        task.recordCount = recordCount
      }
    }
  }

  // 🔧 新增: 为指定任务添加日志
  function addLogToTask(taskId: string, level: string, message: string, customTime?: string) {
    if (!taskLogs.value.has(taskId)) {
      taskLogs.value.set(taskId, [])
    }
    
    const taskLogList = taskLogs.value.get(taskId)!
    taskLogList.push({
      time: customTime || new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message
    })
    
    // 限制每个任务的日志数量(最多500条)
    if (taskLogList.length > 500) {
      taskLogList.shift()
    }
  }

  // 🔧 废弃: 保留兼容性,但不再直接使用
  function addLog(level: string, message: string) {
    console.warn('[Store] addLog已废弃,请使用addLogToTask')
    if (currentTask.value?.id) {
      addLogToTask(currentTask.value.id, level, message)
    }
  }

  // 清空指定任务的日志
  function clearLogs(taskId?: string) {
    const targetTaskId = taskId || currentTask.value?.id
    if (targetTaskId && taskLogs.value.has(targetTaskId)) {
      taskLogs.value.set(targetTaskId, [])
    }
  }

  // 🔧 新增: 下载任务日志为文本文件（从后端API读取完整日志）
  async function downloadLogs(taskId?: string) {
    const targetTaskId = taskId || currentTask.value?.id
    if (!targetTaskId) {
      ElMessage.warning('没有可下载的日志')
      return
    }

    try {
      // 1. 从后端API获取完整日志
      const res = await taskApi.getTaskLogs(targetTaskId, 10000)  // 最多获取10000条
      
      if (!res.data || !res.data.logs || res.data.logs.length === 0) {
        ElMessage.warning('该任务暂无日志记录')
        return
      }

      // 2. 格式化日志内容
      const logContent = res.data.logs.map(log => {
        const timestamp = log.timestamp || new Date().toISOString()
        const level = log.level ? `[${log.level.toUpperCase()}]` : '[INFO]'
        return `${timestamp} ${level} ${log.message}`
      }).join('\n')

      // 3. 创建Blob对象
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
      
      // 4. 创建下载链接
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // 5. 生成文件名：使用完整任务ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      link.download = `task_${targetTaskId}_${timestamp}.log`
      
      // 6. 触发下载
      document.body.appendChild(link)
      link.click()
      
      // 7. 清理
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      ElMessage.success(`已下载 ${res.data.logs.length} 条日志（共${res.data.totalLines}条）`)
    } catch (error: any) {
      console.error('[Download Logs] Error:', error)
      ElMessage.error(error.response?.data?.error || '日志下载失败')
    }
  }

  // 🔧 新增: 切换当前任务时,确保日志数组存在
  function setCurrentTask(task: Task | null) {
    currentTask.value = task
    if (task?.id && !taskLogs.value.has(task.id)) {
      taskLogs.value.set(task.id, [])
    }
  }

  return {
    socket,
    tasks,
    currentTask,
    logs, // 保持兼容性,现在是计算属性
    taskLogs, // 暴露完整的日志Map
    isConnected,
    reconnectAttempts,  // 🔧 新增：重连尝试次数
    maxReconnectAttempts,  // 🔧 新增：最大重连次数
    runningTasks,
    statistics,
    connectSocket,
    disconnectSocket,
    subscribeTask,
    unsubscribeTask,
    createTask,
    startTask,
    loadTasks,
    stopTask,
    pauseTask,
    resumeTask,
    deleteTask,
    updateTaskConfig,  // 🔧 新增：更新任务配置
    addLog, // 保持兼容性
    addLogToTask, // 新方法
    clearLogs,
    downloadLogs, // 新方法
    setCurrentTask // 新方法
  }
})
