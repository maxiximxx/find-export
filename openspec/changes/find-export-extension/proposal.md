# Find Export — VS Code Extension

## Problem

在前端项目开发中，很难快速知道一个模块的某个 export 被项目中哪些文件使用了。现有的 "Find All References" 需要逐个符号查找，无法一次性查看整个文件所有导出的使用情况，且无法直观地在侧边栏汇总展示。

## Solution

开发一个 VS Code 插件 "Find Export"，基于 import 引用链追踪，找出项目中所有使用了目标文件导出的位置，结果展示在侧边栏面板中，支持点击跳转和高亮。

## Core Features

### 1. 查询触发
- 右键菜单 "Find Export"
- 命令面板 "Find Export: Search"
- 选中文本 → 只查该导出；未选中 → 查整个文件所有导出

### 2. 查询机制
- **基于 import 引用链追踪**，不是全文文本搜索
- 解析目标文件 AST 提取所有 export 语句
- 扫描项目文件的静态 import 语句，通过路径解析（含别名）匹配目标文件
- 扫描项目文件的动态 import() 调用，识别对目标文件的动态引用（仅展示文件级）
- 支持 re-export 追踪（直接 re-export + 重命名 re-export）
- 不支持 namespace re-export (`export *`) 的精确追踪（展示文件级引用作为兜底）
- 忽略 .gitignore 中配置的文件和目录

### 3. 路径别名解析
自动检测并解析路径别名，优先级：
1. 用户手动配置（VS Code settings.json）— 最高优先级
2. tsconfig.json / jsconfig.json 的 paths 字段
3. vite.config.ts/js 的 resolve.alias
4. webpack 配置的 resolve.alias（支持配置目录、多文件、require 链追踪、path.resolve 静态计算）

解析失败时提示用户手动配置别名。

### 4. 侧边栏展示
```
📄 src/utils/helper.ts (目标文件)
├─ 🌐 被静态引用:
│  └─ src/utils/index.ts:1
├─ 🔄 被动态引用:
│  ├─ src/pages/home.tsx:15
│  └─ src/pages/about.tsx:8
├─ 📦 formatDate (export const)
│  ├─ src/pages/home.tsx:5
│  └─ src/pages/about.tsx:12
├─ 📦 parseJSON (export const)
│  └─ src/api/request.ts:8
└─ 📦 helper (export default)
   └─ src/app.ts:6
```
- 按导出名分组
- 顶层显示文件级静态引用（re-export 文件）
- 顶层显示文件级动态引用（import() 调用，仅文件级，不追踪具体导出）
- 点击结果跳转到文件对应行并高亮该行

### 5. 技术实现
- AST 解析: TypeScript Compiler API (内置 ts 模块)
- UI: TreeView + TreeDataProvider
- 高亮: TextEditorDecorationType
- 文件遍历: workspace.findFiles + .gitignore 过滤
- 支持文件类型: .ts / .tsx / .js / .jsx

## Non-goals
- 不支持 monorepo 多包场景
- 不支持 namespace re-export (`export *`) 的精确追踪
- 不支持动态 re-export（`module.exports = require(...)` 的复杂场景）
- 不做增量索引（初版实时查询，后续优化）

## Technical Approach

### 目录结构
```
src/
├── extension.ts              ← 入口
├── parser/
│   ├── export-parser.ts      ← 解析目标文件 export
│   └── import-scanner.ts     ← 扫描项目 import
├── resolver/
│   ├── path-resolver.ts      ← 路径解析核心
│   ├── tsconfig-reader.ts
│   ├── vite-config-reader.ts
│   ├── webpack-config-reader.ts
│   └── alias-merger.ts
├── tracker/
│   ├── usage-tracker.ts      ← 导出→使用点映射
│   └── reexport-tracer.ts    ← re-export 链追踪
├── ui/
│   ├── sidebar-provider.ts   ← TreeDataProvider
│   └── highlight.ts          ← 高亮装饰
└── types.ts
```

### 核心流程
1. 用户触发命令 → 确定目标文件 + 是否有选中文本
2. 解析目标文件 AST → 提取所有 export（名称、类型、行号）
3. 扫描项目文件 import → 路径解析匹配目标文件 → 提取引用了哪些导出
4. 追踪 re-export 链 → 递归直到到达最终使用点
5. 构建 TreeItem 数据 → 渲染侧边栏
6. 点击结果 → 跳转 + 高亮
