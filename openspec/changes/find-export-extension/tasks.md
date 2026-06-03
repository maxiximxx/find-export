# Find Export — Implementation Tasks

## Phase 1: 项目初始化与基础框架

- [ ] 1.1 初始化 VS Code Extension 项目 (yo code 或手动)
- [ ] 1.2 配置 package.json (命令、菜单、视图、配置项)
- [ ] 1.3 搭建基本目录结构 (parser/resolver/tracker/ui)
- [ ] 1.4 定义共享类型 (types.ts)

## Phase 2: 路径别名解析

- [ ] 2.1 实现 tsconfig/jsconfig paths 读取 (tsconfig-reader.ts)
- [ ] 2.2 实现 vite.config alias 读取 (vite-config-reader.ts)
- [ ] 2.3 实现 webpack config 发现 + require 链追踪 (webpack-config-reader.ts)
- [ ] 2.4 实现 path.resolve 静态计算
- [ ] 2.5 实现别名合并 + 用户配置覆盖 (alias-merger.ts)
- [ ] 2.6 实现路径解析核心 (path-resolver.ts)
- [ ] 2.7 解析失败时提示用户手动配置

## Phase 3: .gitignore 过滤

- [ ] 3.1 实现 .gitignore 文件读取和解析
- [ ] 3.2 集成 minimatch 进行文件过滤

## Phase 4: Export 解析

- [ ] 4.1 实现 export 声明解析 (export const/function/class)
- [ ] 4.2 实现 export default 解析 (提取变量名)
- [ ] 4.3 实现 export { A, B as C } 解析
- [ ] 4.4 实现 re-export 解析 (export { A } from './x')

## Phase 5: Import 扫描

- [ ] 5.1 实现项目文件遍历 (workspace.findFiles)
- [ ] 5.2 实现 import 语句解析 (default + named)
- [ ] 5.3 集成路径解析，匹配目标文件
- [ ] 5.4 集成 .gitignore 过滤
- [ ] 5.5 识别 re-export 语句 (export { A } from './x')
- [ ] 5.6 实现动态 import() 扫描 (dynamic-import-scanner.ts)
- [ ] 5.7 动态 import 路径解析匹配目标文件 (仅文件级，不追踪具体导出)

## Phase 6: Re-export 追踪

- [ ] 6.1 实现 re-export 链递归追踪 (reexport-tracer.ts)
- [ ] 6.2 处理重命名 re-export (export { A as B })
- [ ] 6.3 防止循环引用

## Phase 7: 使用结果组装

- [ ] 7.1 实现 usage-tracker.ts 组装导出→使用点映射
- [ ] 7.2 收集文件级整体引用 (export * 场景的兜底)

## Phase 8: 侧边栏 UI

- [ ] 8.1 实现 TreeDataProvider (sidebar-provider.ts)
- [ ] 8.2 注册 TreeView 到 explorer 视图
- [ ] 8.3 实现根节点 (目标文件名)
- [ ] 8.4 实现文件级静态引用节点 (🌐 被静态引用)
- [ ] 8.5 实现文件级动态引用节点 (🔄 被动态引用)
- [ ] 8.6 实现导出分组节点 (📦 导出名)
- [ ] 8.6 实现使用位置叶子节点 (文件:行号)
- [ ] 8.7 实现点击跳转命令 (findExport.openFile)

## Phase 9: 高亮与导航

- [ ] 9.1 实现 TextEditorDecorationType 高亮装饰
- [ ] 9.2 点击结果后跳转到文件对应行
- [ ] 9.3 跳转后高亮该行，3 秒后自动清除

## Phase 10: 命令注册与触发

- [ ] 10.1 注册命令 findExport.search
- [ ] 10.2 实现右键菜单触发
- [ ] 10.3 实现命令面板触发
- [ ] 10.4 检测选中文本 (有选中 → 只查该导出，无选中 → 查全部)
- [ ] 10.5 触发后自动打开侧边栏面板

## Phase 11: 集成测试与优化

- [ ] 11.1 在 TS 项目中测试基本查询流程
- [ ] 11.2 在 JS 项目中测试
- [ ] 11.3 测试 re-export 场景
- [ ] 11.4 测试路径别名解析 (tsconfig + vite + webpack)
- [ ] 11.5 测试 .gitignore 过滤
- [ ] 11.6 测试选中文本查询
- [ ] 11.7 大项目性能测试与优化
