import { useMemo } from 'react'
import { NodeType, type GongwenAST, type DocumentNode } from '../types/ast'
import {
  DetectionStatus,
  DetectionPointType,
  type DetectionPoint,
  type DetectionResult,
  type BodyStats,
  type DateWarning,
  type HeadingLevelWarning,
  type HeadingNumberWarning,
  type HeadingNumberIssue,
  DateWarningType,
} from '../types/detection'

/** 日期警告阈值（天数） */
var DATE_WARNING_THRESHOLD = 7

/** 中文数字字符 */
var CHINESE_DIGITS = '一二三四五六七八九十'

/**
 * 将中文数字转换为阿拉伯数字
 * 支持：一~十、十一~十九、二十~九十九
 */
function chineseToNumber(str: string): number | null {
  if (!str || str.length === 0) return null
  
  // 单个数字
  if (str.length === 1) {
    var idx = CHINESE_DIGITS.indexOf(str)
    return idx >= 0 ? idx + 1 : null
  }
  
  // 处理 "十"、"十一"~"十九"
  if (str.charAt(0) === '十') {
    if (str.length === 1) return 10
    var rest = chineseToNumber(str.slice(1))
    return rest ? 10 + rest : null
  }
  
  // 处理 "二十"~"九十九"
  if (str.length === 2 && str.charAt(1) === '十') {
    var tens = chineseToNumber(str.charAt(0))
    return tens ? tens * 10 : null
  }
  
  // 处理 "二十一"~"九十九"
  if (str.length >= 2 && str.indexOf('十') > 0) {
    var parts = str.split('十')
    if (parts.length === 2) {
      var tensPart = chineseToNumber(parts[0])
      var onesPart = parts[1] ? chineseToNumber(parts[1]) : 0
      if (tensPart && (onesPart !== null || parts[1] === '')) {
        return tensPart * 10 + (onesPart || 0)
      }
    }
  }
  
  return null
}

/**
 * 从标题内容中解析序号
 * 返回序号数值，如果无法解析返回 null
 */
function parseHeadingNumber(content: string, level: number): number | null {
  if (!content) return null
  
  if (level === 1) {
    // 一级标题：一、二、三...
    var match1 = content.match(/^([一二三四五六七八九十]+)、/)
    if (match1) return chineseToNumber(match1[1])
  } else if (level === 2) {
    // 二级标题：（一）、（二）...
    var match2 = content.match(/^（([一二三四五六七八九十]+)）/)
    if (match2) return chineseToNumber(match2[1])
  } else if (level === 3) {
    // 三级标题：1.、2.、3...
    var match3 = content.match(/^(\d+)\./)
    if (match3) return parseInt(match3[1], 10)
  } else if (level === 4) {
    // 四级标题：（1）、（2）...
    var match4 = content.match(/^（(\d+)）/)
    if (match4) return parseInt(match4[1], 10)
  }
  
  return null
}

/**
 * 从文本中解析日期
 * 支持格式：XXXX年X月X日 或 XXXX年XX月XX日
 */
function parseChineseDate(text: string): Date | null {
  var match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) return null
  var year = parseInt(match[1], 10)
  var month = parseInt(match[2], 10)
  var day = parseInt(match[3], 10)
  var date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/**
 * 检查日期是否需要警告
 * 如果日期偏离当前日期超过阈值天数（早或晚），返回警告信息
 */
function checkDateWarning(dateContent: string): DateWarning | null {
  var date = parseChineseDate(dateContent)
  if (!date) return null

  var today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  var diffTime = today.getTime() - date.getTime()
  var diffDays = Math.abs(Math.floor(diffTime / (1000 * 60 * 60 * 24)))

  if (diffDays > DATE_WARNING_THRESHOLD) {
    return {
      type: DateWarningType.DATE_DEVIATION,
      message: '偏离当前日期 ' + diffDays + ' 天，请确认',
      severity: 'warning',
      daysDiff: diffDays,
    }
  }
  return null
}

/**
 * 计算正文统计信息
 * 正文定义：四级标题 + 所有正文段落 + 附件说明
 */
function calculateBodyStats(body: DocumentNode[]): BodyStats {
  var charCount = 0
  var paragraphCount = 0
  var headingCounts = { h1: 0, h2: 0, h3: 0, h4: 0 }

  for (var i = 0; i < body.length; i++) {
    var node = body[i]
    switch (node.type) {
      case NodeType.HEADING_1:
        headingCounts.h1++
        charCount += node.content.length
        break
      case NodeType.HEADING_2:
        headingCounts.h2++
        charCount += node.content.length
        break
      case NodeType.HEADING_3:
        headingCounts.h3++
        charCount += node.content.length
        break
      case NodeType.HEADING_4:
        headingCounts.h4++
        charCount += node.content.length
        break
      case NodeType.PARAGRAPH:
        paragraphCount++
        charCount += node.content.length
        break
      case NodeType.ATTACHMENT:
        charCount += node.content.length
        break
      default:
        break
    }
  }

  return {
    charCount,
    paragraphCount,
    headingCounts,
  }
}

/**
 * 检查标题层级是否正确
 * 规则：二级标题必须在一级标题内，三级标题必须在二级标题内，四级标题必须在三级标题内
 */
function checkHeadingLevel(body: DocumentNode[]): HeadingLevelWarning | null {
  var issues: Array<{ content: string; level: number; missingParentLevel: number }> = []
  
  var hasH1 = false
  var hasH2 = false
  var hasH3 = false
  
  for (var i = 0; i < body.length; i++) {
    var node = body[i]
    if (node.type === NodeType.HEADING_1) {
      hasH1 = true
      hasH2 = false
      hasH3 = false
    } else if (node.type === NodeType.HEADING_2) {
      if (!hasH1) {
        issues.push({
          content: node.content,
          level: 2,
          missingParentLevel: 1,
        })
      } else {
        hasH2 = true
        hasH3 = false
      }
    } else if (node.type === NodeType.HEADING_3) {
      if (!hasH2) {
        issues.push({
          content: node.content,
          level: 3,
          missingParentLevel: hasH1 ? 2 : 1,
        })
      } else {
        hasH3 = true
      }
    } else if (node.type === NodeType.HEADING_4) {
      if (!hasH3) {
        issues.push({
          content: node.content,
          level: 4,
          missingParentLevel: hasH2 ? 3 : (hasH1 ? 2 : 1),
        })
      }
    }
  }
  
  return issues.length > 0 ? { issues: issues } : null
}

/**
 * 检查标题序号是否正确
 * 各级标题在其父级范围内应从1开始依次递增
 */
function checkHeadingNumber(body: DocumentNode[]): HeadingNumberWarning | null {
  var issues: HeadingNumberIssue[] = []
  
  var h1Expected = 1  // 一级标题期望序号
  var h2Expected = 1  // 当前一级标题下的二级标题期望序号
  var h3Expected = 1  // 当前二级标题下的三级标题期望序号
  var h4Expected = 1  // 当前三级标题下的四级标题期望序号
  
  for (var i = 0; i < body.length; i++) {
    var node = body[i]
    
    if (node.type === NodeType.HEADING_1) {
      var actualNum = parseHeadingNumber(node.content, 1)
      if (actualNum !== null && actualNum !== h1Expected) {
        issues.push({
          content: node.content,
          level: 1,
          expected: h1Expected,
          actual: actualNum,
          description: actualNum > h1Expected ? '序号跳跃' : '序号重复',
        })
      }
      h1Expected = (actualNum || h1Expected) + 1
      h2Expected = 1  // 重置二级标题序号
      h3Expected = 1  // 重置三级标题序号
      h4Expected = 1  // 重置四级标题序号
    } else if (node.type === NodeType.HEADING_2) {
      var actualNum2 = parseHeadingNumber(node.content, 2)
      if (actualNum2 !== null && actualNum2 !== h2Expected) {
        issues.push({
          content: node.content,
          level: 2,
          expected: h2Expected,
          actual: actualNum2,
          description: actualNum2 > h2Expected ? '序号跳跃' : '序号重复',
        })
      }
      h2Expected = (actualNum2 || h2Expected) + 1
      h3Expected = 1  // 重置三级标题序号
      h4Expected = 1  // 重置四级标题序号
    } else if (node.type === NodeType.HEADING_3) {
      var actualNum3 = parseHeadingNumber(node.content, 3)
      if (actualNum3 !== null && actualNum3 !== h3Expected) {
        issues.push({
          content: node.content,
          level: 3,
          expected: h3Expected,
          actual: actualNum3,
          description: actualNum3 > h3Expected ? '序号跳跃' : '序号重复',
        })
      }
      h3Expected = (actualNum3 || h3Expected) + 1
      h4Expected = 1  // 重置四级标题序号
    } else if (node.type === NodeType.HEADING_4) {
      var actualNum4 = parseHeadingNumber(node.content, 4)
      if (actualNum4 !== null && actualNum4 !== h4Expected) {
        issues.push({
          content: node.content,
          level: 4,
          expected: h4Expected,
          actual: actualNum4,
          description: actualNum4 > h4Expected ? '序号跳跃' : '序号重复',
        })
      }
      h4Expected = (actualNum4 || h4Expected) + 1
    }
  }
  
  return issues.length > 0 ? { issues: issues } : null
}

/**
 * 从 body 中查找指定类型的节点
 */
function findNodeByType(body: DocumentNode[], type: NodeType): DocumentNode | null {
  for (var i = 0; i < body.length; i++) {
    if (body[i].type === type) {
      return body[i]
    }
  }
  return null
}

/**
 * 创建检测点
 */
function createDetectionPoint(
  type: DetectionPointType,
  status: DetectionStatus,
  label: string,
  content: string | null,
  meta: Record<string, unknown>
): DetectionPoint {
  return {
    type: type,
    status: status,
    label: label,
    content: content,
    meta: meta,
  }
}

/**
 * 检测数据计算 Hook
 * 根据 AST 计算各检测点的状态和内容
 */
export function useDetectionData(ast: GongwenAST): DetectionResult {
  return useMemo(function () {
    var points: DetectionPoint[] = []
    var bodyStats = calculateBodyStats(ast.body)
    var headingLevelWarning = checkHeadingLevel(ast.body)
    var headingNumberWarning = checkHeadingNumber(ast.body)

    // 1. 公文标题（支持多段标题）
    if (ast.title.length > 0) {
      // 多段标题用换行符连接显示
      var titleContent = ast.title.map(function(node) { return node.content }).join('\n')
      points.push(
        createDetectionPoint(
          DetectionPointType.TITLE,
          DetectionStatus.DETECTED,
          '公文标题',
          titleContent,
          {}
        )
      )
    } else {
      points.push(
        createDetectionPoint(
          DetectionPointType.TITLE,
          DetectionStatus.MISSING,
          '公文标题',
          null,
          {}
        )
      )
    }

    // 2. 主送机关
    var addresseeNode = findNodeByType(ast.body, NodeType.ADDRESSEE)
    if (addresseeNode) {
      points.push(
        createDetectionPoint(
          DetectionPointType.ADDRESSEE,
          DetectionStatus.DETECTED,
          '主送机关',
          addresseeNode.content,
          {}
        )
      )
    } else {
      points.push(
        createDetectionPoint(
          DetectionPointType.ADDRESSEE,
          DetectionStatus.MISSING,
          '主送机关',
          null,
          {}
        )
      )
    }

    // 3. 正文内容
    var bodyStatus = bodyStats.charCount > 0 ? DetectionStatus.DETECTED : DetectionStatus.MISSING
    if (headingLevelWarning || headingNumberWarning) {
      bodyStatus = DetectionStatus.WARNING
    }
    points.push(
      createDetectionPoint(
        DetectionPointType.BODY,
        bodyStatus,
        '正文内容',
        null,
        { 
          bodyStats: bodyStats, 
          headingLevelWarning: headingLevelWarning,
          headingNumberWarning: headingNumberWarning,
        }
      )
    )

    // 4. 发文机关署名
    var signatureNode = findNodeByType(ast.body, NodeType.SIGNATURE)
    if (signatureNode) {
      points.push(
        createDetectionPoint(
          DetectionPointType.SIGNATURE,
          DetectionStatus.DETECTED,
          '发文机关署名',
          signatureNode.content,
          {}
        )
      )
    } else {
      points.push(
        createDetectionPoint(
          DetectionPointType.SIGNATURE,
          DetectionStatus.MISSING,
          '发文机关署名',
          null,
          {}
        )
      )
    }

    // 5. 成文日期
    var dateNode = findNodeByType(ast.body, NodeType.DATE)
    if (dateNode) {
      var dateWarning = checkDateWarning(dateNode.content)
      if (dateWarning) {
        points.push(
          createDetectionPoint(
            DetectionPointType.DATE,
            DetectionStatus.WARNING,
            '成文日期',
            dateNode.content,
            { dateWarning: dateWarning }
          )
        )
      } else {
        points.push(
          createDetectionPoint(
            DetectionPointType.DATE,
            DetectionStatus.DETECTED,
            '成文日期',
            dateNode.content,
            {}
          )
        )
      }
    } else {
      points.push(
        createDetectionPoint(
          DetectionPointType.DATE,
          DetectionStatus.MISSING,
          '成文日期',
          null,
          {}
        )
      )
    }

    return { points: points, bodyStats: bodyStats }
  }, [ast])
}
