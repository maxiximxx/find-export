# Find Export

Find where a file's exports are used across your TypeScript/JavaScript project.

## Features

- 📦 View all usages of a file's exports
- 🌐 Static references (`import` / `export ... from`)
- 🔄 Dynamic references (`import()`)
- 🔗 Re-export chain tracing
- 📍 Click to jump and highlight import + usage lines
- 🔤 Default exports, named exports, renamed imports
- 🛣️ Automatic path alias resolution (tsconfig / vite / webpack)

## Usage

### Context Menu

1. Open a `.ts` / `.tsx` / `.js` / `.jsx` file
2. Right-click in the editor → **Find Export: Search**
3. The results panel opens automatically in the sidebar

### Command Palette

1. `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)
2. Type **Find Export: Search**

### Search a Specific Export

Select an export name before running the search to query only that export's usages.

## Results Panel

```
📄 index.ts                    ← Target file
  🌐 Static References (5)     ← import / export ... from (collapsed by default)
  🔄 Dynamic References (1)    ← import() (collapsed by default)
  📦 getUrlParams (3)          ← Each export and its usages
    src/views/Home.tsx:10
    src/utils/request.ts:25
  📦 isNumber (0)              ← No usages found
```

## Path Aliases

Path aliases are automatically resolved from the following sources (in ascending priority, later overrides earlier):

1. webpack.config `resolve.alias`
2. vite.config `resolve.alias`
3. tsconfig.json / jsconfig.json `paths` (with project references support)
4. VS Code setting `findExport.aliases`

You can also configure aliases manually in VS Code settings:

```json
{
  "findExport.aliases": {
    "@": "./src",
    "@components": "./src/components"
  }
}
```

## Supported Languages

- TypeScript (`.ts`)
- TypeScript React (`.tsx`)
- JavaScript (`.js`)
- JavaScript React (`.jsx`)
