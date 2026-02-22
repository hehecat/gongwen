import { useLayoutEffect, useState, type RefObject } from 'react'
import type { DocumentNode } from '../types/ast'
import { useDocumentConfig } from '../contexts/DocumentConfigContext'

/** 单页裁剪信息 */
export interface PageSlice {
  /** 内容在完整流中的起始偏移(px) */
  offsetY: number
  /** 该页应显示的内容高度(px)，精确到行边界 */
  clipHeight: number
}

/**
 * DOM 度量分页 hook（视窗裁剪方案）
 *
 * 在隐藏的度量容器中渲染全部节点，通过 offsetTop / offsetHeight / lineHeight
 * 逐行计算分页断点。每页只需一个 offsetY 值，配合 CSS overflow:hidden + transform
 * 偏移实现段落内自然跨页断行。
 *
 * 同时监听 ResizeObserver，窗口缩放时自动重新分页。
 */
export function usePagination(
  title: DocumentNode | null,
  body: DocumentNode[],
  measurerRef: RefObject<HTMLDivElement | null>
): PageSlice[] {
  const { config } = useDocumentConfig()
  const [pages, setPages] = useState<PageSlice[]>(() => [{ offsetY: 0, clipHeight: 0 }])

  useLayoutEffect(() => {
    const measurer = measurerRef.current
    if (!measurer) return

    function calculate() {
      const el = measurerRef.current
      if (!el) {
        setPages([{ offsetY: 0, clipHeight: 0 }])
        return
      }

      const scrollContainer = el.parentElement
      if (!scrollContainer) {
        setPages([{ offsetY: 0, clipHeight: 0 }])
        return
      }

      // ① 同步度量容器宽度：使用 getBoundingClientRect 获取精确浮点宽度，
      //    避免 offsetWidth 整数取整导致度量容器与 A4 页面文本换行不一致。
      const a4Page = scrollContainer.querySelector('.a4-page') as HTMLElement | null
      if (a4Page) {
        el.style.width = `${a4Page.getBoundingClientRect().width}px`
      } else {
        const cs = getComputedStyle(scrollContainer)
        const contentWidth = scrollContainer.clientWidth
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        el.style.width = `${Math.min(contentWidth, 595)}px`
      }

      // ② 读取真实 CSS 可用高度：直接从已渲染的 A4 页面 .a4-content 读取，
      //    消除 JS 公式计算与 CSS 亚像素取整之间的差异。
      //    .a4-content 的 height:100% + box-sizing:border-box 使其总高度 = 页面高度，
      //    内容区 = 总高度 - paddingTop - paddingBottom。
      let availableHeight: number
      const a4Content = a4Page?.querySelector('.a4-content') as HTMLElement | null
      if (a4Content) {
        const rect = a4Content.getBoundingClientRect()
        const contentCs = getComputedStyle(a4Content)
        availableHeight = rect.height
          - parseFloat(contentCs.paddingTop) - parseFloat(contentCs.paddingBottom)
      } else {
        // 首次渲染无 A4 页面时回退到 JS 公式
        const pageWidth = el.getBoundingClientRect().width
        const pageHeight = pageWidth * (297 / 210)
        const topPad = pageWidth * (config.margins.top * 10 / 210)
        const bottomPad = pageWidth * (config.margins.bottom * 10 / 210)
        availableHeight = pageHeight - topPad - bottomPad
      }

      // 注意：不对 availableHeight 做 Math.floor(x / lineHeight) * lineHeight 取整。
      // 原做法在 CSS 取整恰好多出空间时会丢失一整行容量（"比实际 doc 少一行"）。
      // 由分页断点算法保证每页只含完整行，无需预先对齐。

      // ③ 获取基准行高（从度量容器的段落 computed lineHeight 读取）
      const contentEl = el.querySelector('.a4-measurer-content')
      if (!contentEl) {
        setPages([{ offsetY: 0, clipHeight: availableHeight }])
        return
      }

      const paragraphs = contentEl.querySelectorAll<HTMLParagraphElement>(':scope > p')
      if (paragraphs.length === 0) {
        setPages([{ offsetY: 0, clipHeight: availableHeight }])
        return
      }

      // ④ 收集所有行的 top/bottom 位置
      interface LinePos { top: number; bottom: number }
      const lines: LinePos[] = []

      for (const p of paragraphs) {
        const pTop = p.offsetTop
        const pHeight = p.offsetHeight
        const computedStyle = getComputedStyle(p)
        const lineHeight = parseFloat(computedStyle.lineHeight)

        if (isNaN(lineHeight) || lineHeight <= 0 || pHeight <= lineHeight * 1.5) {
          lines.push({ top: pTop, bottom: pTop + pHeight })
        } else {
          const lineCount = Math.max(1, Math.round(pHeight / lineHeight))
          // 使用 CSS line-height 定位行边界（而非 pHeight/lineCount），
          // 避免混合字体 inline span 导致段落高度偏离 line-height 整数倍时
          // 断点位置与实际渲染不一致（半行字问题）。
          // 最后一行 bottom 取段落实际底部，衔接下一段。
          for (let i = 0; i < lineCount; i++) {
            lines.push({
              top: pTop + i * lineHeight,
              bottom: i < lineCount - 1 ? pTop + (i + 1) * lineHeight : pTop + pHeight,
            })
          }
        }
      }

      // ⑤ 按行边界分页（严格比较，不加 +0.5 容差）
      //    原 +0.5 容差允许超出可用高度的行被放入当前页，
      //    但 CSS .a4-content overflow:hidden 在真实边界截断 → 半行字。
      const breakOffsets: number[] = [0]
      let pageStart = 0

      for (const line of lines) {
        // 当前行底部超出当前页可用高度 → 推入下一页
        // line.top - pageStart > 0.5 防止页首行触发分页（死循环保护）
        if (line.bottom - pageStart > availableHeight && line.top - pageStart > 0.5) {
          pageStart = line.top
          breakOffsets.push(pageStart)
        }
      }

      // ⑥ 根据断点计算每页 clipHeight
      //    clipHeight = 下一页 offsetY - 当前页 offsetY，天然对齐行边界。
      //    不再 min(x, availableHeight)：断点算法已保证每页内容 ≤ availableHeight。
      const totalContentHeight = lines.length > 0 ? lines[lines.length - 1].bottom : 0
      const result: PageSlice[] = breakOffsets.map((offset, i) => {
        const nextOffset = i < breakOffsets.length - 1 ? breakOffsets[i + 1] : totalContentHeight
        return {
          offsetY: offset,
          clipHeight: nextOffset - offset,
        }
      })

      setPages(result)
    }

    // 初始计算
    calculate()

    // 监听尺寸变化（窗口缩放时重新分页）
    const observer = new ResizeObserver(() => calculate())
    observer.observe(measurer)
    return () => observer.disconnect()
  }, [title, body, measurerRef, config])

  return pages
}
