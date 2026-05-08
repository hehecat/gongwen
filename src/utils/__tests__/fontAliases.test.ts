import { describe, expect, it } from 'vitest'
import { getPreviewFontFamily, getPreviewMixedFontFamily } from '../fontAliases'

describe('getPreviewFontFamily', () => {
  it('为核心公文字体展开浏览器预览别名链', () => {
    expect(getPreviewFontFamily('方正小标宋_GBK')).toBe(
      '"方正小标宋_GBK", "方正小标宋简体", "FZXiaoBiaoSong-B05S", "FZXiaoBiaoSong-B05"',
    )
    expect(getPreviewFontFamily('仿宋_GB2312')).toBe(
      '"仿宋_GB2312", "仿宋", "FangSong_GB2312", "FangSong", "STFangsong"',
    )
  })

  it('保留未知字体名，避免影响自定义字体输入', () => {
    expect(getPreviewFontFamily('Custom Sans')).toBe('"Custom Sans"')
  })

  it('尊重用户已经输入的 font-family 列表', () => {
    expect(getPreviewFontFamily('"Custom Sans", serif')).toBe('"Custom Sans", serif')
  })
})

describe('getPreviewMixedFontFamily', () => {
  it('将英数字体排在中文字体前面，供浏览器预览混排文本使用', () => {
    expect(getPreviewMixedFontFamily('仿宋_GB2312', 'Times New Roman')).toBe(
      '"Times New Roman", "仿宋_GB2312", "仿宋", "FangSong_GB2312", "FangSong", "STFangsong"',
    )
  })

  it('英数字体为空时回退为中文字体链', () => {
    expect(getPreviewMixedFontFamily('仿宋_GB2312', '')).toBe(
      '"仿宋_GB2312", "仿宋", "FangSong_GB2312", "FangSong", "STFangsong"',
    )
  })
})
