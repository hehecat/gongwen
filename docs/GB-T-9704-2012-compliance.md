# GB/T 9704—2012《党政机关公文格式》对照实现规范

本文档记录项目对照 [GB/T 9704—2012](file:///Users/hehecat/gongwen/docs/GB-T-9704-2012.pdf) 各条款的参数映射与代码实现位置。

## 1. 纸张与版面（§5）

| 条款 | 标准规定 | 本项目实现 | 对应位置 |
| --- | --- | --- | --- |
| §5.1 幅面尺寸 | A4 型纸：210 mm × 297 mm | `11906 × 16838 twips`；72dpi 固定预览画布 `595.28 × 841.89 px` | `src/layout/constants.ts`、`src/exporter/docxBuilder.ts` |
| §5.2.1 页边与版心 | 天头 37 mm±1 mm，订口 28 mm±1 mm，版心 156 mm × 225 mm（即下白边 35 mm、右白边 26 mm） | `DEFAULT_CONFIG.margins`: top `3.7` cm / bottom `3.5` cm / left `2.8` cm / right `2.6` cm | `src/types/documentConfig.ts` |
| §5.2.2 字体字号 | 无特殊说明用 3 号仿宋体字 | `DEFAULT_CONFIG.body`: `仿宋_GB2312`、`16 pt`（3号） | `src/types/documentConfig.ts`、`src/exporter/styleFactory.ts` |
| §5.2.3 行数字数 | 每面 22 行，每行 28 字，撑满版心 | 每行 28 字由字符间距算法撑满版心；固定行距 `28.9 pt`（`22 × 28.9 = 635.8 pt ≤ 225 mm`） | `src/types/documentConfig.ts`、`src/layout/typography.ts` |
| §5.2.4 文字颜色 | 除特殊说明外均为黑色 | 标题/各级标题/正文/附件/落款显式设置 `000000` | `src/exporter/styles.ts`、`src/exporter/styleFactory.ts` |

## 2. 版头要素（§7.2）

| 条款 | 标准规定 | 本项目实现 | 对应位置 |
| --- | --- | --- | --- |
| §7.2.1 份号 | 6 位 3 号阿拉伯数字，顶格版心左上角第一行 | `header.copyNumber` | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |
| §7.2.2 密级和保密期限 | 3 号黑体，顶格版心左上角第二行（如 `秘密★1年`） | `header.secretLevel` | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |
| §7.2.3 紧急程度 | 3 号黑体，顶格版心左上角，按份号→密级→紧急程度自上而下分行排列 | `header.urgency` | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |
| §7.2.4 发文机关标志 | 红色小标宋体字居中，上边缘至版心上边缘 35 mm；联合行文右侧居中可加「文件」 | 支持字体、字号、居中/分散对齐、字距、多行联合行文+右侧后缀、自定义红头图片 | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |
| §7.2.5 发文字号 | 标志下空二行居中；年份用六角括号`〔〕`，顺序号不加「第」、不编虚位；上行文居左空一字与末位签发人同行 | 支持标准居中与上行文居左空一字，及`〔〕`规范化检查/净化 | `src/layout/typography.ts`、`src/exporter/headerBuilder.ts`、`src/checker/gongwenChecker.ts` |
| §7.2.6 签发人 | 「签发人：」3 号仿宋 + 姓名 3 号楷体，居右空一字；多人每行两人、回行对齐首人 | `parseSigners` 自动按每行 2 人排布并与发文字号末行对齐 | `src/layout/typography.ts`、`src/exporter/headerBuilder.ts` |
| §7.2.7 分隔线 | 发文字号下 4 mm 处居中与版心等宽红色分隔线 | 支持单红线、居中红星`★`红线、无分隔线 | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |

## 3. 主体要素（§7.3）

| 条款 | 标准规定 | 本项目实现 | 对应位置 |
| --- | --- | --- | --- |
| §7.3.1 标题 | 2 号小标宋体居中，红色分隔线下空二行，分一行或多行 | `22 pt`、多行标题仅末行留段后空行、去除错误加粗 | `src/exporter/styleFactory.ts`、`src/components/Preview/A4Page.css` |
| §7.3.2 主送机关 | 标题下空一行居左顶格，回行顶格，末名后全角冒号；过多可移至版记 | `ADDRESSEE` 顶格对齐；支持版记 `mainRecipient` | `src/parser/parser.ts`、`src/exporter/footerNoteBuilder.ts` |
| §7.3.3 正文与层次 | 首页显示正文；3 号仿宋首行缩进 2 字；层次「一、」「（一）」「1.」「（1）」对应黑体/楷体/仿宋 | 四级标题解析、Word `Heading1~4` 样式映射、首句拆分 | `src/parser/matchers.ts`、`src/exporter/styles.ts`、`src/layout/typography.ts` |
| §7.3.4 附件说明 | 正文下空一行左空二字「附件：」，多附件用阿拉伯数字序号且回行与首字对齐，名称后不加标点 | `ATTACHMENT` 解析与悬挂缩进，体检器检测末位标点 | `src/parser/parser.ts`、`src/exporter/styleFactory.ts`、`src/checker/gongwenChecker.ts` |
| §7.3.5.1 加盖印章 | 成文日期右空四字，署名以日期为基准居中，空二行 | `calculateSignatureLayout(..., hasStamp=true)` | `src/layout/typography.ts` |
| §7.3.5.2 不加盖印章 | 署名正文下空一行右空二字，成文日期首字比署名首字右移二字（日期更长则右空二字、署名左移） | `calculateSignatureLayout(..., hasStamp=false)` | `src/layout/typography.ts` |
| §7.3.5.3 签名章 | 空二行右空四字签发人签名章，左侧空二字标全称职务，下空一行右空四字日期 | `specialOptions.signerTitle` + `signerStampName` | `src/exporter/docxBuilder.ts`、`src/components/Preview/DocumentFlow.tsx` |
| §7.3.5.4 成文日期 | 阿拉伯数字标全年月日，月日不编虚位 | 解析识别与规范体检一键修复 | `src/checker/gongwenChecker.ts` |
| §7.3.6 附注 | 居左空二字加圆括号编排在成文日期下一行 | `NodeType.POSTSCRIPT` 自动识别与排版 | `src/parser/parser.ts`、`src/exporter/styleFactory.ts` |
| §7.3.7 附件另面 | 另面编排，左上角第一行顶格 3 号黑体「附件」及序号 | `NodeType.ATTACHMENT_PAGE_HEADER`（分节/分页符另起一面） | `src/parser/parser.ts`、`src/exporter/styleFactory.ts` |

## 4. 版记与页码（§7.4 & §7.5）

| 条款 | 标准规定 | 本项目实现 | 对应位置 |
| --- | --- | --- | --- |
| §7.4.1 版记分隔线 | 与版心等宽，首末粗线 `0.35 mm`、中间细线 `0.25 mm`，末线与末页版心下边缘重合 | 浮动表格锚定末页版心底部 + 预览绝对定位底部 | `src/exporter/footerNoteBuilder.ts`、`src/components/Preview/A4Page.css` |
| §7.4.2 抄送/主送机关 | 4 号仿宋，左右各空一字（按 4 号字计），回行对齐冒号后首字，末名后标句号；主送在抄送之上无分隔线 | `footerNote.mainRecipient` & `footerNote.cc`，`ptToTwip(14)` 缩进 | `src/exporter/footerNoteBuilder.ts` |
| §7.4.3 印发机关与日期 | 4 号仿宋，左空一字机关、右空一字日期+「印发」 | `footerNote.printer` & `footerNote.printDate` | `src/exporter/footerNoteBuilder.ts` |
| §7.5 页码 | 4 号半角宋体阿拉伯数字，左右一字线，上距版心下边缘 7 mm，单右双左各空一字 | 使用 `specialOptions.pageNumberFont`（默认宋体），支持国标/居中 | `src/exporter/pageNumberBuilder.ts` |

## 5. 特定格式（§10）

| 条款 | 标准规定 | 本项目实现 | 对应位置 |
| --- | --- | --- | --- |
| §10.1 信函格式 | 标志上距上页边 30 mm；下 4 mm 印 170 mm 上粗下细双红线；距下页边 20 mm 印 170 mm 上细下粗双红线；发文字号居双线下右顶格，份号/密级/紧急居左顶格；首页不显示页码；版记无印发机关日期与分隔线 | `header.format = 'letter'` 完整预览与 DOCX 导出（含 `titlePage` 首页页脚双红线） | `src/exporter/headerBuilder.ts`、`src/exporter/pageNumberBuilder.ts`、`src/exporter/footerNoteBuilder.ts` |
| §10.2 命令（令）格式 | 标志由发文机关+「命令」/「令」组成，上距版心 20 mm；下空二行居中令号，令号下空二行正文；可配合签名章 | `header.format = 'command'` | `src/exporter/headerBuilder.ts`、`src/components/Preview/A4Page.tsx` |
| §10.3 纪要格式 | 标志由「XXXXX 纪要」组成，上距版心 35 mm；出席/请假/列席用 3 号黑体+冒号+3 号仿宋并回行对齐 | `header.format = 'minutes'` + `NodeType.MINUTES_ATTENDANCE` | `src/parser/matchers.ts`、`src/exporter/styleFactory.ts` |
