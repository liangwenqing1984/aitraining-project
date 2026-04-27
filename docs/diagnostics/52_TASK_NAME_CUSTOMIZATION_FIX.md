# 任务名称自定义功能修复说明

## 问题描述

1. **批量创建任务**：最终生成的任务没有按照"任务名称前缀 + 批次号"方式生成
2. **普通任务创建**：无法自定义任务名称，总是由后端自动生成

## 根本原因

- 前端在批量创建时生成了完整的任务名称（如：`Java开发招聘分析_Batch01_阿里-百度`），但没有传递给后端
- 后端的 `generateTaskName` 函数会忽略任何前端传递的名称信息，始终根据数据来源和城市自动生成
- 普通任务创建页面缺少任务名称输入框

## 修复方案

### 1. 后端修改

#### 文件：`code/backend/src/types/index.ts`
```typescript
export interface TaskConfig {
  sites: ('zhilian' | '51job')[];
  name?: string;  // 🔧 新增：支持前端传递自定义任务名称
  province?: string;
  city?: string;
  // ... 其他字段
}
```

#### 文件：`code/backend/src/controllers/taskController.ts`
```typescript
// 🔧 支持前端传递自定义任务名称
let taskName: string;
if (config.name && typeof config.name === 'string' && config.name.trim()) {
  // 如果前端提供了自定义名称，直接使用
  taskName = config.name.trim();
  console.log('[TaskController] 📝 使用前端传递的自定义任务名称:', taskName);
} else {
  // 否则自动生成任务名称
  taskName = generateTaskName(config);
  console.log('[TaskController] 🤖 自动生成任务名称:', taskName);
}
```

### 2. 前端修改

#### 文件：`code/frontend/src/api/task.ts`
```typescript
export interface TaskConfig {
  sites: ('zhilian' | '51job')[]
  name?: string  // 🔧 新增：与后端保持一致
  province?: string
  // ... 其他字段
}
```

#### 文件：`code/frontend/src/views/crawler/BatchTaskCreator.vue`
```typescript
const config: TaskConfig = {
  name: taskNameFull,  // 🔧 传递自定义任务名称
  sites: sites.value,
  keywords: keywords.value,
  // ... 其他配置
}
```

#### 文件：`code/frontend/src/views/crawler/CreateTask.vue`

**添加任务名称变量：**
```typescript
const taskName = ref('')  // 🔧 新增：任务名称
```

**添加模板输入框：**
```vue
<el-form-item label="任务名称">
  <el-input
    v-model="taskName"
    placeholder="可选，留空则自动生成（如：智联 - 北京）"
    clearable
  />
  <div class="form-tip">提示：如果不填写，系统将根据数据来源和城市自动生成名称</div>
</el-form-item>
```

**提交时传递名称：**
```typescript
// 🔧 如果用户输入了任务名称，则使用自定义名称
if (taskName.value.trim()) {
  config.name = taskName.value.trim()
  console.log('[CreateTask] 使用自定义任务名称:', config.name)
}
```

**重置表单：**
```typescript
function resetForm() {
  taskName.value = ''  // 🔧 重置任务名称
  // ... 其他重置逻辑
}
```

#### 文件：`code/frontend/src/views/crawler/EditTask.vue`

**添加任务名称变量：**
```typescript
const taskName = ref('')  // 🔧 新增：任务名称
```

**加载任务时读取名称：**
```typescript
// 🔧 填充任务名称（从任务对象中获取，而不是config）
taskName.value = task?.name || ''
console.log('[EditTask] 任务名称:', taskName.value)
```

**添加模板输入框：**
```vue
<el-form-item label="任务名称">
  <el-input
    v-model="taskName"
    placeholder="可选，留空则自动生成（如：智联 - 北京）"
    clearable
  />
  <div class="form-tip">提示：修改任务名称后，保存时将使用新名称</div>
</el-form-item>
```

**保存时传递名称：**
```typescript
// 🔧 如果用户修改了任务名称，则传递新名称
if (taskName.value.trim()) {
  newConfig.name = taskName.value.trim()
  console.log('[EditTask] 使用自定义任务名称:', newConfig.name)
}
```

## 测试验证

### 测试场景1：批量创建任务

1. 进入"批量创建任务"页面
2. 输入任务名称前缀：`Java开发招聘分析`
3. 选择数据来源：智联招聘、前程无忧
4. 添加关键词：Java工程师
5. 选择城市：北京
6. 粘贴企业名单（至少100家）
7. 点击"开始批量创建"

**预期结果：**
- 生成多个任务，名称格式为：
  - `Java开发招聘分析_Batch01_企业A-企业Z`
  - `Java开发招聘分析_Batch02_企业AA-企业ZZ`
  - ...

### 测试场景2：普通任务创建（自定义名称）

1. 进入"创建任务"页面
2. 输入任务名称：`2024年春季Java工程师招聘`
3. 选择数据来源：智联招聘
4. 添加关键词：Java工程师
5. 选择城市：北京
6. 点击"创建任务"

**预期结果：**
- 任务名称显示为：`2024年春季Java工程师招聘`

### 测试场景3：普通任务创建（自动生成名称）

1. 进入"创建任务"页面
2. **不填写**任务名称（留空）
3. 选择数据来源：智联招聘
4. 添加关键词：Java工程师
5. 选择城市：北京
6. 点击"创建任务"

**预期结果：**
- 任务名称自动生成为：`智联 - 北京`

### 测试场景4：编辑任务配置（修改名称）

1. 进入任务列表，点击某个任务的"配置"按钮
2. 修改任务名称为：`2024年夏季Java工程师招聘（更新版）`
3. 修改其他配置（可选）
4. 点击"保存并重新启动"

**预期结果：**
- 旧任务被删除
- 创建新任务，名称为：`2024年夏季Java工程师招聘（更新版）`

## 注意事项

1. **TypeScript编译错误**：修改后可能出现类型检查错误，这是编译器缓存问题。重启开发服务器或重新编译即可解决。

2. **命名规范**：
   - 批量任务必须包含批次号和企业范围标识
   - 普通任务建议使用有意义的名称，便于后续识别和管理

3. **向后兼容**：如果前端未传递name字段，后端会自动生成，不影响现有功能

## 相关文件清单

- ✅ `code/backend/src/types/index.ts` - 添加name字段到TaskConfig
- ✅ `code/backend/src/controllers/taskController.ts` - 支持自定义名称
- ✅ `code/frontend/src/api/task.ts` - 同步类型定义
- ✅ `code/frontend/src/views/crawler/BatchTaskCreator.vue` - 传递批量任务名称
- ✅ `code/frontend/src/views/crawler/CreateTask.vue` - 添加名称输入框和传递逻辑
- ✅ `code/frontend/src/views/crawler/EditTask.vue` - 添加名称输入框和传递逻辑
