# 前端UI风格设计规范与提示词

## 整体设计风格

### 视觉风格描述
现代简约风格，采用浅色主题，注重留白和层次感，使用圆角和柔和阴影营造轻盈感，色彩搭配温和，强调功能性和易用性。

### 设计理念
- **简约至上**: 界面元素精简，突出核心内容
- **功能性优先**: 注重用户体验和操作效率
- **视觉层次**: 通过颜色、阴影、间距构建清晰的信息层级
- **响应式设计**: 适配不同屏幕尺寸

---

## 色彩规范

### 主色调
- **背景色**: #f5f7fa (浅灰蓝)
- **主背景**: #ffffff (纯白)
- **次级背景**: #f9fafb, #f3f4f6 (极浅灰)

### 品牌色系
- **蓝色系** (总任务数): #3b82f6 - #2563eb (渐变)
- **橙色系** (运行中): #f59e0b - #d97706 (渐变)
- **绿色系** (已完成): #10b981 - #059669 (渐变)
- **紫色系** (总数据量): #8b5cf6 - #7c3aed (渐变)

### 文字颜色
- **主要文字**: #1a1a1a (深灰黑)
- **次要文字**: #6b7280 (中灰)
- **辅助文字**: #9ca3af (浅灰)

### 边框颜色
- **边框色**: #e8eaed, #e5e7eb (浅灰)
- **悬停边框**: #d0d3d9 (中浅灰)

---

## 字体规范

### 字体族
- **默认字体**: 系统默认字体栈
- **中文**: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB"
- **英文**: "Helvetica Neue", "Microsoft YaHei", Arial, sans-serif

### 字号层级
- **数值**: 32px (重要数据)
- **标签**: 14px (普通文本)
- **标题**: 16-18px (重要标题)

### 字重规范
- **重要数值**: 700 (粗体)
- **标签**: 500 (中等)
- **普通文本**: 400 (常规)

---

## 组件规范

### 卡片设计
- **圆角**: 12px
- **内边距**: 24px
- **阴影**: 0 2px 8px rgba(0, 0, 0, 0.06)
- **悬停阴影**: 0 4px 16px rgba(0, 0, 0, 0.1)
- **边框**: 1px solid #e8eaed
- **悬停边框**: 1px solid #d0d3d9

### 按钮样式
- **主按钮**: 蓝色主题，圆角设计
- **悬停效果**: 轻微阴影加深和边框色变化
- **禁用状态**: 透明度降低

### 表格样式
- **斑马纹**: 使用el-table的stripe属性
- **边框**: 简洁线条
- **行高**: 适中，保证可读性

---

## 交互反馈

### 动画效果
- **过渡时长**: 0.3s
- **缓动函数**: ease
- **悬停变换**: translateY(-2px), scale(1.05)
- **图标脉冲**: gentle-pulse动画，2.5s循环

### 状态指示
- **运行中**: 脉冲动画效果
- **加载**: 旋转动画
- **成功/错误**: Element UI内置状态色

---

## 布局规范

### 间距系统
- **基础单位**: 8px倍数
- **页面边距**: 24px
- **组件间距**: 12px-24px
- **内边距**: 8px-24px

### 响应式断点
- **断点**: 适配桌面和移动设备
- **侧边栏**: 可折叠设计（展开240px，收起70px）

---

## 设计提示词

### 整体风格提示词
```
Modern minimalist UI design, light theme with soft shadows and rounded corners, clean and functional interface, subtle color gradients for visual hierarchy, smooth transitions, professional business software aesthetic, focused on usability and efficiency, flat design with depth through shadow layers
```

### 卡片设计提示词
```
Card-based design with 12px rounded corners, soft drop shadow (0 2px 8px rgba(0,0,0,0.06)), white background with subtle border (#e8eaed), hover effect with increased shadow depth (0 4px 16px rgba(0,0,0,0.1)) and slight elevation, smooth transition on state changes, colored accent strip on left side with gradient, clean typography with clear hierarchy
```

### 颜色搭配提示词
```
Subtle blue (#3b82f6 to #2563eb), warm amber (#f59e0b to #d97706), fresh green (#10b981 to #059669), rich purple (#8b5cf6 to #7c3aed) for accent elements, neutral backgrounds with #f5f7fa and #ffffff, dark gray text (#1a1a1a) for primary content, medium gray (#6b7280) for secondary text, soft borders (#e8eaed), clean and professional palette
```

### 交互效果提示词
```
Smooth hover effects with subtle elevation, gentle scaling animations (0.3s ease), pulse animations for active states, fade transitions for content appearance, consistent timing functions throughout, visual feedback for interactive elements, clear focus states, responsive interactions that feel natural and intuitive
```

### 布局结构提示词
```
Clean sidebar navigation with collapsible design, content area with generous whitespace, grid-based responsive layout, consistent spacing using 8px base unit, hierarchical information organization, prominent statistics cards, organized table views, clear visual separation between sections, professional dashboard layout
```

---

## 元素细节

### 图标设计
- **风格**: 线性图标，简洁明了
- **大小**: 16px-24px
- **颜色**: 与主题色协调
- **交互**: 悬停时轻微变色

### 表单元素
- **输入框**: 圆角设计，清晰边框
- **下拉菜单**: 轻柔阴影，圆角面板
- **标签**: 清晰的视觉层级

### 导航元素
- **面包屑**: 清晰路径指示
- **侧边栏**: 固定宽度，图标+文字
- **顶栏**: 信息展示，用户操作区

---

## 设计原则总结

1. **一致性**: 所有界面元素遵循相同的设计语言
2. **可读性**: 清晰的字体、适当的对比度和间距
3. **可用性**: 直观的交互和清晰的信息层级
4. **美观性**: 现代简约风格，精致的视觉细节
5. **响应性**: 适配不同设备和屏幕尺寸
6. **品牌性**: 统一的品牌色彩和视觉识别