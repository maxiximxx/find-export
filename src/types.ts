export interface ExportInfo {
  name: string;           // 导出名 (export default 的 name 是变量名)
  kind: 'named' | 'default';
  line: number;           // 行号 (1-based)
  specifier?: string;     // re-export 来源路径
}

export interface ImportInfo {
  file: string;           // 文件绝对路径
  imports: string[];      // import 了哪些导出名
  line: number;           // import 语句行号
  isReExport: boolean;    // 是否是 re-export
  reExportFrom?: string;  // re-export 的来源路径
  defaultLocalName?: string; // 默认导入的本地名 (import X from '...' 中的 X)
  renamedImports?: Record<string, string>; // 重命名映射 { exportName: localName }
}

export interface UsageResult {
  exportName: string;     // 导出名
  file: string;           // 使用文件绝对路径
  line: number;           // 使用行号
  context?: string;       // 该行代码内容 (用于预览)
  isReExport: boolean;    // 是否是 re-export 引用
  depth: number;          // re-export 链深度 (0 = 直接引用)
  localName?: string;     // 默认导入的本地名 (用于高亮)
}

export interface AliasConfig {
  [alias: string]: string; // '@' → '/project/src'
}

export interface DynamicImportInfo {
  file: string;   // 发起动态 import 的文件绝对路径
  line: number;   // import() 调用所在行号
}
