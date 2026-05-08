const PREVIEW_FONT_ALIASES: Record<string, string[]> = {
  方正小标宋简体: ['方正小标宋简体', '方正小标宋_GBK', 'FZXiaoBiaoSong-B05S', 'FZXiaoBiaoSong-B05'],
  方正小标宋_GBK: ['方正小标宋_GBK', '方正小标宋简体', 'FZXiaoBiaoSong-B05S', 'FZXiaoBiaoSong-B05'],
  仿宋_GB2312: ['仿宋_GB2312', '仿宋', 'FangSong_GB2312', 'FangSong', 'STFangsong'],
  仿宋: ['仿宋', '仿宋_GB2312', 'FangSong', 'FangSong_GB2312', 'STFangsong'],
  楷体_GB2312: ['楷体_GB2312', '楷体', 'KaiTi_GB2312', 'KaiTi', 'STKaiti'],
  楷体: ['楷体', '楷体_GB2312', 'KaiTi', 'KaiTi_GB2312', 'STKaiti'],
  黑体: ['黑体', 'SimHei', 'STHeiti', 'Heiti SC'],
  宋体: ['宋体', 'SimSun', 'STSong', 'Songti SC'],
  新宋体: ['新宋体', 'NSimSun', '宋体', 'SimSun', 'STSong'],
  华文中宋: ['华文中宋', 'STZhongsong'],
  华文仿宋: ['华文仿宋', 'STFangsong', '仿宋', 'FangSong'],
  华文楷体: ['华文楷体', 'STKaiti', '楷体', 'KaiTi'],
  华文彩云: ['华文彩云', 'STCaiyun'],
}

function quoteFontFamily(fontName: string): string {
  const trimmed = fontName.trim()
  if (!trimmed) return ''
  if (trimmed.includes(',')) return trimmed
  if (/^["'].*["']$/.test(trimmed)) return trimmed
  return `"${trimmed.replace(/["\\]/g, '\\$&')}"`
}

/**
 * 仅用于浏览器预览的字体族展开。
 * DOCX 导出仍保留用户原始字体名，交给 Word 自行匹配。
 */
export function getPreviewFontFamily(fontName: string): string {
  const trimmed = fontName.trim()
  if (!trimmed) return ''
  if (trimmed.includes(',')) return trimmed

  const aliases = PREVIEW_FONT_ALIASES[trimmed] ?? [trimmed]
  const uniqueAliases = [...new Set(aliases.map((name) => name.trim()).filter(Boolean))]

  return uniqueAliases.map(quoteFontFamily).join(', ')
}

export function getPreviewMixedFontFamily(eastAsiaFontName: string, asciiFontName: string): string {
  const eastAsiaFamily = getPreviewFontFamily(eastAsiaFontName)
  const asciiFamily = getPreviewFontFamily(asciiFontName)
  const combined = [asciiFamily, eastAsiaFamily]
    .flatMap((family) => family.split(','))
    .map((name) => name.trim())
    .filter(Boolean)

  return [...new Set(combined)].join(', ')
}
