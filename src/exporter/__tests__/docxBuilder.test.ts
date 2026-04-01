import { describe, expect, it } from 'vitest'
import { AlignmentType } from 'docx'
import { getPageNumberParagraphOptions } from '../docxBuilder'

describe('getPageNumberParagraphOptions', () => {
  it('国标样式使用单右双左', () => {
    const options = getPageNumberParagraphOptions('mirrored', 280)

    expect(options).toEqual({
      evenAndOddHeaderAndFooters: true,
      defaultOptions: {
        alignment: AlignmentType.RIGHT,
        indent: { right: 280 },
      },
      evenOptions: {
        alignment: AlignmentType.LEFT,
        indent: { left: 280 },
      },
    })
  })

  it('全居中样式关闭奇偶页差异', () => {
    const options = getPageNumberParagraphOptions('center', 280)

    expect(options).toEqual({
      evenAndOddHeaderAndFooters: false,
      defaultOptions: {
        alignment: AlignmentType.CENTER,
        indent: {},
      },
    })
  })
})
