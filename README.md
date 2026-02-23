# 公文排版工具

基于 GB/T 9704 国标的党政机关公文在线排版工具，支持实时预览、智能分页和 DOCX 导出。

🔗 **在线体验：https://hehecat.github.io/gongwen/**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhehecat%2Fgongwen)

## 功能特性

- **实时预览** — 左侧编辑、右侧即时 A4 分页预览
- **智能解析** — 自动识别公文标题、一至四级标题、主送机关、附件说明、成文日期等结构
- **DOCX 导出** — 一键生成符合国标格式的 Word 文档
- **文件导入** — 拖拽或点击导入 .docx / .txt 文件，自动提取纯文本进行格式化洗稿
- **自动净化** — 半角标点自动转全角、多余空白自动清理，无需手动操作
- **版头排版** — 发文机关标志（红色大字）、发文字号与签发人（无边框表格同行对齐）、红色分隔线
- **版记排版** — 抄送机关、印发机关与印发日期（左右对齐），首末粗线 + 中间细线
- **格式可配置** — 页边距、字体、字号、行距、首行缩进等参数均可自定义
- **国标默认值** — 方正小标宋标题、仿宋正文、三号字、29磅行距等开箱即用
- **本地持久化** — 编辑内容与配置自动保存到 localStorage，刷新不丢失

## 技术栈

- React 19 + TypeScript
- Vite 7
- [docx](https://github.com/dolanmedia/docx) — DOCX 文件生成
- [mammoth](https://github.com/mwilliamson/mammoth.js) — .docx 文件纯文本提取
- [file-saver](https://github.com/nickeahman/FileSaver.js) — 浏览器端文件下载
- GitHub Actions — 自动构建部署到 GitHub Pages

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览构建产物
```

## 项目结构

```
src/
├── components/
│   ├── Editor/          # 文本编辑器（支持拖拽上传）
│   ├── Preview/         # A4 分页预览 (A4Page + Preview)
│   ├── SettingsModal/   # 格式配置弹窗（含版头/版记设置）
│   └── Toolbar/         # 顶部工具栏（导入/导出）
├── contexts/            # DocumentConfig 全局状态
├── exporter/            # DOCX 导出 (docxBuilder + styleFactory)
├── hooks/               # useDocumentParser / usePagination
├── parser/              # 公文文本 → AST 解析器
├── types/               # AST 节点类型 / 文档配置类型
├── utils/               # 文件导入 / 标点净化
└── constants/           # GB/T 9704 排版常量
```

## License

MIT
