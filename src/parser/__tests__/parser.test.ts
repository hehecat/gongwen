import { describe, it, expect } from 'vitest'
import { parseGongwen } from '../parser'
import { detectNodeType, extractAttachmentItemsFromLine } from '../matchers'
import { NodeType } from '../../types/ast'
import type { AttachmentNode } from '../../types/ast'

// ---- detectNodeType 单元测试 ----
describe('detectNodeType', () => {
  it('识别一级标题（中文数字+顿号）', () => {
    expect(detectNodeType('一、总体要求')).toBe(NodeType.HEADING_1)
    expect(detectNodeType('十二、附则')).toBe(NodeType.HEADING_1)
  })

  it('识别二级标题（全角括号）', () => {
    expect(detectNodeType('（一）指导思想')).toBe(NodeType.HEADING_2)
    expect(detectNodeType('（十）保障措施')).toBe(NodeType.HEADING_2)
  })

  it('识别二级标题（半角括号容错）', () => {
    expect(detectNodeType('(一)指导思想')).toBe(NodeType.HEADING_2)
    expect(detectNodeType('(二)基本原则')).toBe(NodeType.HEADING_2)
  })

  it('识别三级标题（阿拉伯数字+点号）', () => {
    expect(detectNodeType('1.加强组织领导')).toBe(NodeType.HEADING_3)
    expect(detectNodeType('12．完善制度体系')).toBe(NodeType.HEADING_3)
  })

  it('识别三级标题（中文数字+是/要）', () => {
    expect(detectNodeType('一是加强组织领导')).toBe(NodeType.HEADING_3)
    expect(detectNodeType('二是落实责任分工')).toBe(NodeType.HEADING_3)
    expect(detectNodeType('三要完善制度体系')).toBe(NodeType.HEADING_3)
    expect(detectNodeType('十一是总结经验')).toBe(NodeType.HEADING_3)
  })

  it('识别四级标题（阿拉伯数字+括号）', () => {
    expect(detectNodeType('（1）制定实施方案')).toBe(NodeType.HEADING_4)
    expect(detectNodeType('(2)明确责任分工')).toBe(NodeType.HEADING_4)
  })

  it('正文段落', () => {
    expect(detectNodeType('为深入贯彻落实党的二十大精神')).toBe(NodeType.PARAGRAPH)
    expect(detectNodeType('现就有关事项通知如下：')).toBe(NodeType.PARAGRAPH)
  })

  it('行首非标题模式不误判为三级标题', () => {
    expect(detectNodeType('不是问题所在')).toBe(NodeType.PARAGRAPH)
    expect(detectNodeType('只要努力就能成功')).toBe(NodeType.PARAGRAPH)
  })

  it('识别附件说明（全角冒号）', () => {
    expect(detectNodeType('附件：1.实施方案')).toBe(NodeType.ATTACHMENT)
  })

  it('识别附件说明（半角冒号容错）', () => {
    expect(detectNodeType('附件:2.责任清单')).toBe(NodeType.ATTACHMENT)
  })

  it('识别成文日期', () => {
    expect(detectNodeType('2025年10月21日')).toBe(NodeType.DATE)
    expect(detectNodeType('2026年1月5日')).toBe(NodeType.DATE)
  })

  it('非日期文本不误匹配为 DATE', () => {
    expect(detectNodeType('2025年工作计划')).toBe(NodeType.PARAGRAPH)
    expect(detectNodeType('2025年10月')).toBe(NodeType.PARAGRAPH)
  })
})

// ---- parseGongwen 单元测试 ----
describe('parseGongwen', () => {
  it('空文本返回空 AST', () => {
    const ast = parseGongwen('')
    expect(ast.title).toBeNull()
    expect(ast.body).toHaveLength(0)
  })

  it('仅空行返回空 AST', () => {
    const ast = parseGongwen('\n\n  \n')
    expect(ast.title).toBeNull()
    expect(ast.body).toHaveLength(0)
  })

  it('第一个非空行识别为公文标题', () => {
    const ast = parseGongwen('关于加强安全生产工作的通知')
    expect(ast.title).not.toBeNull()
    expect(ast.title!.type).toBe(NodeType.DOCUMENT_TITLE)
    expect(ast.title!.content).toBe('关于加强安全生产工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
  })

  it('跳过空行后识别标题', () => {
    const ast = parseGongwen('\n\n关于加强安全生产工作的通知')
    expect(ast.title!.lineNumber).toBe(3)
  })

  it('完整公文解析', () => {
    const text = [
      '关于加强安全生产工作的通知',
      '',
      '一、总体要求',
      '为深入贯彻落实党的二十大精神，现就有关事项通知如下。',
      '（一）指导思想',
      '坚持以习近平新时代中国特色社会主义思想为指导。',
      '1.加强组织领导',
      '（1）制定实施方案',
      '各部门要高度重视安全生产工作。',
    ].join('\n')

    const ast = parseGongwen(text)

    expect(ast.title!.type).toBe(NodeType.DOCUMENT_TITLE)
    expect(ast.title!.content).toBe('关于加强安全生产工作的通知')

    expect(ast.body).toHaveLength(7)
    expect(ast.body[0].type).toBe(NodeType.HEADING_1)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[2].type).toBe(NodeType.HEADING_2)
    expect(ast.body[3].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[4].type).toBe(NodeType.HEADING_3)
    expect(ast.body[5].type).toBe(NodeType.HEADING_4)
    expect(ast.body[6].type).toBe(NodeType.PARAGRAPH)
  })

  it('正文中含「一是」不误判为标题', () => {
    const ast = parseGongwen('标题\n\n正文内容如下：一是加强组织领导，二是落实责任分工。')
    expect(ast.title!.content).toBe('标题')
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
  })

  it('正确记录行号', () => {
    const text = '标题\n\n一、正文第一节\n内容段落'
    const ast = parseGongwen(text)

    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body[0].lineNumber).toBe(3)
    expect(ast.body[1].lineNumber).toBe(4)
  })

  it('识别主送机关（标题后以冒号结尾的第一行）', () => {
    const text = [
      '关于加强安全生产工作的通知',
      '',
      '各省、自治区、直辖市人民政府：',
      '一、总体要求',
    ].join('\n')

    const ast = parseGongwen(text)

    expect(ast.title!.type).toBe(NodeType.DOCUMENT_TITLE)
    expect(ast.body[0].type).toBe(NodeType.ADDRESSEE)
    expect(ast.body[0].content).toBe('各省、自治区、直辖市人民政府：')
    expect(ast.body[1].type).toBe(NodeType.HEADING_1)
  })

  it('主送机关仅触发一次（第二个冒号结尾行不匹配）', () => {
    const text = [
      '关于工作的通知',
      '各单位：',
      '现就有关事项通知如下：',
    ].join('\n')

    const ast = parseGongwen(text)

    expect(ast.body[0].type).toBe(NodeType.ADDRESSEE)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH) // 第二个冒号行为普通段落
  })

  it('标题后过长的冒号结尾行按正文处理，不误判为主送机关', () => {
    const text = [
      '关于进一步规范劳务派遣单位参加工伤保险有关工作的通知',
      '',
      '为进一步规范劳务派遣单位参加工伤保险工作，切实维护社会保险基金安全和劳动者合法权益，依据《中华人民共和国社会保险法》、《工伤保险条例》、《劳务派遣暂行规定》等相关规定，结合工作实际，现就有关问题通知如下：',
    ].join('\n')

    const ast = parseGongwen(text)

    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
  })

  it('完整公文含主送机关、附件、日期的端到端解析', () => {
    const text = [
      '关于做好2025年安全生产工作的通知',
      '',
      '各省、自治区、直辖市人民政府：',
      '一、总体要求',
      '坚持安全第一、预防为主。',
      '附件：1.实施方案',
      '2025年10月21日',
    ].join('\n')

    const ast = parseGongwen(text)

    expect(ast.title!.type).toBe(NodeType.DOCUMENT_TITLE)
    expect(ast.title!.content).toBe('关于做好2025年安全生产工作的通知')

    expect(ast.body).toHaveLength(5)
    expect(ast.body[0].type).toBe(NodeType.ADDRESSEE)
    expect(ast.body[1].type).toBe(NodeType.HEADING_1)
    expect(ast.body[2].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[3].type).toBe(NodeType.ATTACHMENT)
    expect(ast.body[4].type).toBe(NodeType.DATE)
  })
})

// ---- extractAttachmentItemsFromLine 单元测试 ----
describe('extractAttachmentItemsFromLine', () => {
  it('提取单个附件项', () => {
    const result = extractAttachmentItemsFromLine('1.实施方案', 1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual({ index: 1, name: '实施方案' })
    expect(result.remaining).toBe('')
  })

  it('提取多个连续附件项', () => {
    const result = extractAttachmentItemsFromLine('1.方案A 2.方案B 3.方案C', 1)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({ index: 1, name: '方案A' })
    expect(result.items[1]).toEqual({ index: 2, name: '方案B' })
    expect(result.items[2]).toEqual({ index: 3, name: '方案C' })
    expect(result.remaining).toBe('')
  })

  it('序号不连续时停止提取', () => {
    const result = extractAttachmentItemsFromLine('1.方案A 2.方案B 4.方案D', 1)
    expect(result.items).toHaveLength(2)
    expect(result.remaining).toBe('4.方案D')
  })

  it('支持不同点号格式', () => {
    const result = extractAttachmentItemsFromLine('1．实施方案 2.责任清单', 1)
    expect(result.items).toHaveLength(2)
    expect(result.items[0].name).toBe('实施方案')
    expect(result.items[1].name).toBe('责任清单')
  })
})

// ---- 附件说明解析测试 ----
describe('附件说明解析', () => {
  describe('单附件模式', () => {
    it('识别单附件（冒号后无数字）', () => {
      const text = '标题\n\n附件：关于开展2025年安全生产专项检查的实施方案'
      const ast = parseGongwen(text)

      expect(ast.body[0].type).toBe(NodeType.ATTACHMENT)
      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(false)
      expect(node.items).toHaveLength(1)
      expect(node.items[0].index).toBe(0)
      expect(node.items[0].name).toBe('关于开展2025年安全生产专项检查的实施方案')
    })

    it('单附件冒号后有空格也能识别', () => {
      const text = '标题\n\n附件： 实施方案'
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(false)
      expect(node.items[0].name).toBe('实施方案')
    })

    it('冒号后数字不是1时视为单附件', () => {
      const text = '标题\n\n附件：2.责任清单'
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(false)
      expect(node.items[0].name).toBe('2.责任清单')
    })
  })

  describe('多附件模式', () => {
    it('识别多附件（同行多数字）', () => {
      const text = '标题\n\n附件：1.实施方案 2.责任清单 3.工作计划'
      const ast = parseGongwen(text)

      expect(ast.body[0].type).toBe(NodeType.ATTACHMENT)
      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(true)
      expect(node.items).toHaveLength(3)
      expect(node.items[0]).toEqual({ index: 1, name: '实施方案' })
      expect(node.items[1]).toEqual({ index: 2, name: '责任清单' })
      expect(node.items[2]).toEqual({ index: 3, name: '工作计划' })
    })

    it('识别多附件（分行数字）', () => {
      const text = [
        '标题',
        '',
        '附件：1.实施方案',
        '2.责任清单',
        '3.工作计划',
      ].join('\n')
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(true)
      expect(node.items).toHaveLength(3)
    })

    it('识别多附件（混合格式）', () => {
      const text = [
        '标题',
        '',
        '附件：1.实施方案 2.责任清单',
        '3.工作计划',
      ].join('\n')
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(true)
      expect(node.items).toHaveLength(3)
    })

    it('序号不连续时停止解析（同行剩余内容作为附件说明的一部分）', () => {
      const text = '标题\n\n附件：1.方案A 2.方案B 4.方案D'
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      // 同行异常回退为单附件，保留原始文本避免丢字
      expect(node.isMultiple).toBe(false)
      expect(node.items).toHaveLength(1)
      expect(node.items[0].name).toBe('1.方案A 2.方案B 4.方案D')
      expect(ast.body).toHaveLength(1)
    })

    it('序号不连续时停止解析（分行情况）', () => {
      const text = [
        '标题',
        '',
        '附件：1.方案A 2.方案B',
        '4.方案D',
      ].join('\n')
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.items).toHaveLength(2)
      // 分行的 "4.方案D" 应该被解析为三级标题
      expect(ast.body[1].type).toBe(NodeType.HEADING_3)
    })

    it('后续行异常时不吞掉原文（异常行继续由主循环解析）', () => {
      const text = [
        '标题',
        '',
        '附件：1.方案A',
        '2.方案B 4.方案D',
      ].join('\n')
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.isMultiple).toBe(true)
      expect(node.items).toHaveLength(1)
      expect(node.items[0]).toEqual({ index: 1, name: '方案A' })
      expect(ast.body[1].type).toBe(NodeType.HEADING_3)
      expect(ast.body[1].content).toBe('2.方案B 4.方案D')
    })

    it('支持不同点号格式', () => {
      const text = '标题\n\n附件：1．实施方案 2.责任清单'
      const ast = parseGongwen(text)

      const node = ast.body[0] as AttachmentNode
      expect(node.items).toHaveLength(2)
    })

    it('多附件后正确解析后续内容', () => {
      const text = [
        '标题',
        '',
        '附件：1.实施方案 2.责任清单',
        '2025年10月21日',
      ].join('\n')
      const ast = parseGongwen(text)

      expect(ast.body).toHaveLength(2)
      expect(ast.body[0].type).toBe(NodeType.ATTACHMENT)
      expect(ast.body[1].type).toBe(NodeType.DATE)
    })
  })
})

// ---- 发文机关署名识别测试 ----
describe('发文机关署名识别', () => {
  it('末尾日期前的机关名称识别为 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '国务院办公厅',
      '2025年10月21日',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(2)
    expect(ast.body[0].type).toBe(NodeType.SIGNATURE)
    expect(ast.body[1].type).toBe(NodeType.DATE)
  })

  it('文末只有单位没有日期时也识别为 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '一、有关要求',
      '请各单位认真抓好落实。',
      '国务院办公厅',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(3)
    expect(ast.body[0].type).toBe(NodeType.HEADING_1)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[2].type).toBe(NodeType.SIGNATURE)
  })

  it('日期非末尾时不识别 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '国务院办公厅',
      '2025年10月21日',
      '一、后续说明',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.DATE)
    expect(ast.body[2].type).toBe(NodeType.HEADING_1)
  })

  it('普通短句不应误识别为 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '请认真执行',
      '2025年10月21日',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.DATE)
  })

  it('文末普通短句即使没有日期也不误识别为 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '一、有关要求',
      '请认真执行',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body[0].type).toBe(NodeType.HEADING_1)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH)
  })

  // ---- Phase 3: 带附件时的署名识别 ----
  it('附件在前：正文 + 附件 + 单位 + 日期 → 单位识别为 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '请认真落实。',
      '附件：1.实施方案',
      '国务院办公厅',
      '2025年10月21日',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(4)
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.ATTACHMENT)
    expect(ast.body[2].type).toBe(NodeType.SIGNATURE)
    expect(ast.body[3].type).toBe(NodeType.DATE)
  })

  it('附件在后：正文 + 单位 + 日期 + 附件 → 单位为 SIGNATURE，附件保持 ATTACHMENT', () => {
    const text = [
      '标题',
      '',
      '请认真落实。',
      '国务院办公厅',
      '2025年10月21日',
      '附件：实施方案',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(4)
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.SIGNATURE)
    expect(ast.body[2].type).toBe(NodeType.DATE)
    expect(ast.body[3].type).toBe(NodeType.ATTACHMENT)
  })

  it('多附件 trailing：单位 + 日期 + 两个附件 → 仍识别 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '国务院办公厅',
      '2025年10月21日',
      '附件：1.实施方案',
      '2.责任清单',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(3)
    expect(ast.body[0].type).toBe(NodeType.SIGNATURE)
    expect(ast.body[1].type).toBe(NodeType.DATE)
    expect(ast.body[2].type).toBe(NodeType.ATTACHMENT)
  })

  it('附件在前且无日期：正文 + 附件 + 单位 → SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '请认真落实。',
      '附件：实施方案',
      '国务院办公厅',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(3)
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.ATTACHMENT)
    expect(ast.body[2].type).toBe(NodeType.SIGNATURE)
  })

  it('单位与日期之间夹联系人段落 → 单位不升 SIGNATURE', () => {
    const text = [
      '标题',
      '',
      '国务院办公厅',
      '联系人：张三',
      '2025年10月21日',
    ].join('\n')
    const ast = parseGongwen(text)

    expect(ast.body).toHaveLength(3)
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH) // "联系人：张三" 仍为正文
    expect(ast.body[2].type).toBe(NodeType.DATE)
  })
})

describe('文头标题识别', () => {
  it('单位+标题无空行 → title 包含机关+\\n+标题，单位不在 body', () => {
    const text = [
      'XX市人民政府办公厅',
      '关于加强安全生产工作的通知',
      '各单位：',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('XX市人民政府办公厅\n关于加强安全生产工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body[0].type).toBe(NodeType.ADDRESSEE)
    expect(ast.body[0].content).toBe('各单位：')
    expect(ast.body.some(n => n.content.includes('办公厅'))).toBe(false)
  })

  it('两行拆标题合并', () => {
    const text = [
      '关于进一步规范劳务派遣单位参加',
      '工伤保险有关工作的通知',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('关于进一步规范劳务派遣单位参加工伤保险有关工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body).toHaveLength(0)
  })

  it('三行拆标题合并', () => {
    const text = [
      '关于认真学习贯彻',
      '习近平总书记重要讲话',
      '精神的通知',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('关于认真学习贯彻习近平总书记重要讲话精神的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body).toHaveLength(0)
  })

  it('单位+两行标题', () => {
    const text = [
      '国务院办公厅',
      '关于进一步规范劳务派遣单位参加',
      '工伤保险有关工作的通知',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('国务院办公厅\n关于进一步规范劳务派遣单位参加工伤保险有关工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body.some(n => n.content.includes('办公厅'))).toBe(false)
  })

  it('单行标题保持不变', () => {
    const ast = parseGongwen('关于加强安全生产工作的通知')
    expect(ast.title!.content).toBe('关于加强安全生产工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
  })

  it('标题+主送 现有行为不变', () => {
    const text = [
      '关于加强安全生产工作的通知',
      '',
      '各省、自治区、直辖市人民政府：',
      '一、总体要求',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('关于加强安全生产工作的通知')
    expect(ast.body[0].type).toBe(NodeType.ADDRESSEE)
  })

  it('以「一、总体要求」开头 → title null, body[0] HEADING_1', () => {
    const text = '一、总体要求\n正文内容'
    const ast = parseGongwen(text)
    expect(ast.title).toBeNull()
    expect(ast.body[0].type).toBe(NodeType.HEADING_1)
    expect(ast.body[1].type).toBe(NodeType.PARAGRAPH)
  })

  it('单位与标题间有空行 → title 仍包含机关，空行不写入 content', () => {
    const text = [
      '国务院办公厅',
      '',
      '关于做好有关工作的通知',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('国务院办公厅\n关于做好有关工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body.some(n => n.content.includes('办公厅'))).toBe(false)
  })

  it('市审计局+标题 → title 含市审计局+\\n+标题', () => {
    const text = [
      '市审计局',
      '关于开展审计整改工作的通知',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('市审计局\n关于开展审计整改工作的通知')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body.some(n => n.content.includes('审计局'))).toBe(false)
  })

  it('标题后长正文不并入标题（长段有句号）', () => {
    const text = [
      '关于加强安全生产工作的通知',
      '为深入贯彻落实党的二十大精神和习近平总书记关于安全生产重要指示批示精神，现就有关事项通知如下。',
      '一、总体要求',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('关于加强安全生产工作的通知')
    expect(ast.body[0].type).toBe(NodeType.PARAGRAPH)
    expect(ast.body[1].type).toBe(NodeType.HEADING_1)
  })

  it('仅机关名无标题时机关行当标题', () => {
    const ast = parseGongwen('国务院办公厅')
    expect(ast.title!.content).toBe('国务院办公厅')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body).toHaveLength(0)
  })

  it('机关名后紧跟结构节点时机关行当标题', () => {
    const text = [
      '国务院办公厅',
      '一、总体要求',
    ].join('\n')
    const ast = parseGongwen(text)
    expect(ast.title!.content).toBe('国务院办公厅')
    expect(ast.title!.lineNumber).toBe(1)
    expect(ast.body[0].type).toBe(NodeType.HEADING_1)
  })
})
