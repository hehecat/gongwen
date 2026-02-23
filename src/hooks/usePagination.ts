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
 * 关键：首页扣除版头（.a4-header-section）高度，末页扣除版记（.a4-footer-note）高度，
 * 避免 clipHeight 超出父容器实际可用空间导致 overflow:hidden 截断内容。
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

      // ② 读取 .a4-content 内容区全量高度（= 页面高度 - 上下 padding）
      //    这是不含版头/版记时的最大可用空间。
      let fullAvailable: number
      const a4Content = a4Page?.querySelector('.a4-content') as HTMLElement | null
      if (a4Content) {
        const rect = a4Content.getBoundingClientRect()
        const contentCs = getComputedStyle(a4Content)
        fullAvailable = rect.height
          - parseFloat(contentCs.paddingTop) - parseFloat(contentCs.paddingBottom)
      } else {
        // 首次渲染无 A4 页面时回退到 JS 公式
        const pageWidth = el.getBoundingClientRect().width
        const pageHeight = pageWidth * (297 / 210)
        const topPad = pageWidth * (config.margins.top * 10 / 210)
        const bottomPad = pageWidth * (config.margins.bottom * 10 / 210)
        fullAvailable = pageHeight - topPad - bottomPad
      }

      // ③ 度量版头高度（首页渲染，含外边距；flex column 中 margin 不折叠）
      let headerHeight = 0
      const headerSection = scrollContainer.querySelector('.a4-header-section') as HTMLElement | null
      if (headerSection) {
        const hs = getComputedStyle(headerSection)
        headerHeight = headerSection.offsetHeight
          + parseFloat(hs.marginTop) + parseFloat(hs.marginBottom)
      }

      // ④ 度量版记高度（末页绝对定位于 .a4-page 底部，需预留空间防重叠）
      let footerNoteHeight = 0
      const footerNote = scrollContainer.querySelector('.a4-footer-note') as HTMLElement | null
      if (footerNote) {
        footerNoteHeight = footerNote.offsetHeight
      }

      // 首页可用高度 = 全量 - 版头占位
      const firstPageAvailable = fullAvailable - headerHeight

      // ⑤ 获取度量容器内所有段落
      const contentEl = el.querySelector('.a4-measurer-content')
      if (!contentEl) {
        setPages([{ offsetY: 0, clipHeight: firstPageAvailable }])
        return
      }

      const paragraphs = contentEl.querySelectorAll<HTMLParagraphElement>(':scope > p')
      if (paragraphs.length === 0) {
        setPages([{ offsetY: 0, clipHeight: firstPageAvailable }])
        return
      }

      // ⑥ 收集所有行的 top/bottom 位置
      interface LinePos { top: number; bottom: number }
      const lines: LinePos[] = []

      for (const p of paragraphs) {
        const pTop = p.offsetTop
        const pHeight = p.offsetHeight
        const computedStyle = getComputedStyle(p)
        const lineHeight = parseFloat(computedStyle.lineHeight)

        if (isNaN(lineHeight) || lineHeight <= 0 || pHeight <= lineHeight * 1.5) {
          // 单行段落（标题等）：整段作为一行
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

      const totalContentHeight = lines.length > 0 ? lines[lines.length - 1].bottom : 0

      // ⑦ Phase 1: 按行边界分页
      //    首页使用 firstPageAvailable（扣除版头），后续页使用 fullAvailable。
      const breakOffsets: number[] = [0]
      let pageStart = 0
      let currentAvailable = firstPageAvailable

      for (const line of lines) {
        // 当前行底部超出当前页可用高度 → 推入下一页
        // line.top - pageStart > 0.5 防止页首行触发分页（死循环保护）
        if (line.bottom - pageStart > currentAvailable && line.top - pageStart > 0.5) {
          pageStart = line.top
          breakOffsets.push(pageStart)
          currentAvailable = fullAvailable // 后续页恢复全量高度
        }
      }

      // ⑧ Phase 2: 确保末页有足够空间容纳版记
      //    版记在末页渲染，其高度会挤压 viewport 的可用空间。
      //    如果末页内容 + 版记 > 全量高度，需要将溢出行推到新页。
      if (footerNoteHeight > 0) {
        let maxIterations = 10 // 安全上限，防止极端情况死循环
        let stable = false
        while (!stable && maxIterations-- > 0) {
          stable = true
          const lastIdx = breakOffsets.length - 1
          const lastStart = breakOffsets[lastIdx]
          const isAlsoFirstPage = lastIdx === 0
          const lastPageBase = isAlsoFirstPage ? firstPageAvailable : fullAvailable
          const lastPageAvailable = lastPageBase - footerNoteHeight
          const lastPageContent = totalContentHeight - lastStart

          if (lastPageContent > lastPageAvailable + 0.5) {
            // 在末页中找到溢出行并创建新断点
            for (const line of lines) {
              if (line.top < lastStart + 0.5) continue
              if (line.bottom - lastStart > lastPageAvailable && line.top - lastStart > 0.5) {
                breakOffsets.push(line.top)
                stable = false
                break
              }
            }
          }
        }
      }

      // ⑨ 根据断点计算每页 clipHeight
      //    clipHeight = 下一页 offsetY - 当前页 offsetY，天然对齐行边界。
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
