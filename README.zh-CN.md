# Find Export

[English](./README.md) | 中文

查找文件的导出在整个 TypeScript/JavaScript 项目中的使用位置。

## 功能特性

- 📦 查看文件所有导出的使用情况
- 🌐 静态引用（`import` / `export ... from`）
- 🔄 动态引用（`import()`）
- 🔤 默认导出 (`export default`)、命名导出 (`export { name }`)、重命名导入 (`import { name as alias }`)
- 🏷️ 类型导出（`export interface`、`export type`、`export enum`）
- 🔗 重导出链路追踪
- 📍 点击跳转并高亮导入行和使用行
- 🛣️ 自动路径别名解析（tsconfig / vite / webpack）

## 使用方法

### 右键菜单

1. 打开一个 `.ts` / `.tsx` / `.js` / `.jsx` 文件
2. 在编辑器中右键 → **Find Export: Search**
3. 结果面板会在侧边栏自动打开

### 命令面板

1. `Ctrl+Shift+P`（Mac：`Cmd+Shift+P`）
2. 输入 **Find Export: Search**

### 搜索特定导出

在运行搜索之前选中一个导出名称，可以只查询该导出的使用情况。

## 结果面板

```
📄 index.ts                    ← 目标文件
  🌐 静态引用 (5)               ← import / export ... from（默认折叠）
  🔄 动态引用 (1)               ← import()（默认折叠）
  📦 getUrlParams (3)          ← 每个导出及其使用位置
    src/views/Home.tsx:10
    src/utils/request.ts:25
  📦 isNumber (0)              ← 未找到使用
```

## 路径别名

路径别名会自动从以下来源解析（优先级从低到高，后者覆盖前者）：

1. webpack.config `resolve.alias`
2. vite.config `resolve.alias`
3. tsconfig.json / jsconfig.json `paths`（支持项目引用）
4. VS Code 设置 `findExport.aliases`

也可以在 VS Code 设置中手动配置别名：

```json
{
  "findExport.aliases": {
    "@": "./src",
    "@components": "./src/components"
  }
}
```

## 支持的语言

- TypeScript (`.ts`)
- TypeScript React (`.tsx`)
- JavaScript (`.js`)
- JavaScript React (`.jsx`)
