# Find Export — Feature Spec

## Overview

"Find Export" 是一个 VS Code 插件，用于查找前端项目中 export 导出的使用情况。

## User Stories

### US1: 查询整个文件的导出使用情况
作为前端开发者，我在编辑一个工具函数文件时，想知道这个文件的所有导出分别被哪些文件使用了。
- 右键菜单或命令面板触发查询
- 侧边栏展示所有导出及其使用位置
- 点击任意结果跳转到对应文件和行

### US2: 查询特定导出的使用情况
作为前端开发者，我选中了某个导出名，只想知道这一个导出被谁用了。
- 选中文本后触发查询
- 侧边栏只展示该导出的使用位置

### US3: 查看文件级整体引用
作为前端开发者，我的文件通过 barrel file (index.ts) 被整体 re-export 了，我想知道哪些文件通过这种方式引用了我的文件。
- 侧边栏顶部展示 "被整体引用" 区域
- 列出所有通过 re-export 引用该文件的位置

## Acceptance Criteria

### AC1: 查询准确性
- ✅ 只追踪通过 import 语句引用的结果，不进行全文文本搜索
- ✅ 同名但不同来源的本地函数不会被误匹配
- ✅ 支持直接 re-export (export { A } from './x')
- ✅ 支持重命名 re-export (export { A as B } from './x')
- ✅ 支持动态 import() 识别 (文件级，不追踪具体导出)

### AC2: 路径别名支持
- ✅ 自动读取 tsconfig.json paths 配置
- ✅ 自动读取 vite.config resolve.alias 配置
- ✅ 自动读取 webpack 配置的 resolve.alias (含多文件和 require 链)
- ✅ 用户可通过 settings.json 手动配置别名
- ✅ 别名优先级: 用户配置 > tsconfig > vite > webpack
- ✅ 解析失败时提示用户手动配置

### AC3: 文件过滤
- ✅ 不扫描 .gitignore 中配置的文件和目录
- ✅ 不扫描 node_modules、dist 等构建产物

### AC4: UI 展示
- ✅ 结果展示在侧边栏 TreeView 面板
- ✅ 顶层显示文件级静态引用 (re-export)
- ✅ 顶层显示文件级动态引用 (import() 调用)
- ✅ 按导出名分组
- ✅ 显示文件相对路径和行号
- ✅ 点击结果跳转到文件对应行
- ✅ 跳转后高亮该行 (3 秒自动清除)

### AC5: 触发方式
- ✅ 右键菜单 "Find Export"
- ✅ 命令面板 "Find Export: Search"
- ✅ 支持 .ts / .tsx / .js / .jsx 文件

## Non-functional Requirements

- 插件按需激活 (onCommand)，不影响 VS Code 启动性能
- 查询过程不阻塞 UI，异步执行
- 大项目 (5000+ 文件) 查询时间可接受 (< 10s)
