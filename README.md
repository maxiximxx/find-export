# Find Export

查找 TypeScript/JavaScript 文件中导出（export）在项目中的所有使用位置。

## 功能

- 📦 查看文件所有导出的使用情况
- 🌐 静态引用（`import` / `export ... from`）
- 🔄 动态引用（`import()`）
- 🔗 支持重导出链追踪
- 📍 点击跳转并高亮导入行和使用行
- 🔤 支持默认导出、命名导出、重命名导入
- 🛣️ 自动识别路径别名（tsconfig / vite / webpack）

## 使用方式

### 右键菜单

1. 打开一个 `.ts` / `.tsx` / `.js` / `.jsx` 文件
2. 在编辑器中右键 → **Find Export: Search**
3. 左侧活动栏自动打开结果面板

### 命令面板

1. `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）
2. 输入 **Find Export: Search**

### 搜索特定导出

选中导出名再执行搜索，只查询该导出的使用情况。

## 结果面板

```
📄 index.ts                    ← 目标文件
  🌐 静态引用 (5)              ← import / export ... from（默认折叠）
  🔄 动态引用 (1)              ← import()（默认折叠）
  📦 getUrlParams (3)          ← 每个导出及其使用位置
    src/views/Home.tsx:10
    src/utils/request.ts:25
  📦 isNumber (0)              ← 无使用记录
```

## 路径别名

自动从以下配置读取路径别名（按优先级，后者覆盖前者）：

1. webpack.config 的 `resolve.alias`
2. vite.config 的 `resolve.alias`
3. tsconfig.json / jsconfig.json 的 `paths`（支持 project references）
4. VS Code 设置 `findExport.aliases`

也可以在 VS Code 设置中手动配置：

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
