# 修复编辑器问题计划

## 问题分析

根据用户反馈和截图，需要解决以下问题：

1. **勾选图标未彻底删除** - 截图显示左侧有一个勾选图标（ListItem 功能的拖拽图标）
2. **输入 `-` 自动转换问题** - 用户想输入 `-` 打点时，Milkdown 自动将其转换为列表项并换行
3. **左侧笔记列表需要可隐藏** - 用户希望有沉浸式写作模式，可以隐藏左侧笔记列表

## 解决方案

### 1. 彻底删除 ListItem 勾选图标

**文件**: `src/renderer/components/MilkdownEditor/index.tsx`

- 禁用 `Crepe.Feature.ListItem` 功能
- 添加 CSS 隐藏相关图标元素

### 2. 禁用自动格式化（输入 `-` 问题）

**文件**: `src/renderer/components/MilkdownEditor/index.tsx`

- Milkdown 的自动格式化是通过 input rules 实现的
- 需要禁用或覆盖这些自动转换规则
- 可能需要自定义 Crepe 配置或使用 Milkdown 核心 API 来禁用自动列表转换

### 3. 添加隐藏左侧笔记列表功能

**文件**: `src/renderer/pages/Notes/index.tsx` 和 `src/renderer/pages/Notes/styles.css`

- 添加一个状态控制左侧边栏显示/隐藏
- 在工具栏添加切换按钮
- 添加 CSS 动画效果使切换更平滑
- 支持快捷键切换（如 Cmd/Ctrl + B）

### 4. 检查其他可能的问题

- 检查是否还有其他未禁用的提示/图标
- 确保所有 Crepe 特性都已正确禁用
- 检查编辑器在专注模式下的表现

## 实施步骤

1. 修改 MilkdownEditor 组件，禁用 ListItem 和自动格式化
2. 更新 MilkdownEditor CSS，隐藏残留图标
3. 修改 Notes 页面，添加侧边栏切换功能
4. 更新 Notes 样式，添加动画效果
5. 测试所有功能
6. 重新打包应用

## 预期结果

- 编辑器界面干净，无干扰图标
- 输入 `-` 不会自动转换，保持原样输入
- 可以通过按钮或快捷键隐藏/显示左侧笔记列表
- 整体体验接近 Typora 的沉浸式写作
