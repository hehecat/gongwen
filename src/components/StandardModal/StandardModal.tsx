import { useState, useRef, useEffect, useCallback } from 'react'
import { gb9704Data, flattenSections, type Section } from '../../data/gb9704'
import { gb33476Data } from '../../data/gb33476'
import './StandardModal.css'

interface StandardModalProps {
  onClose: () => void
}

/** 规范配置 */
interface StandardConfig {
  key: string
  title: string
  subtitle: string
  data: Section[]
  footer: string
}

const standards: StandardConfig[] = [
  {
    key: 'gb9704',
    title: '党政机关公文格式',
    subtitle: 'GB/T 9704-2012',
    data: gb9704Data,
    footer: '本标准由 中国国家标准化管理委员会发布',
  },
  {
    key: 'gb33476',
    title: '党政机关电子公文格式规范',
    subtitle: 'GB/T 33476.2-2016 第2部分：显现',
    data: gb33476Data,
    footer: '本标准由 中国国家标准化管理委员会发布',
  },
]

/**
 * 渲染单个章节内容
 */
function SectionContent({ section, level, prefix }: { section: Section; level: number; prefix: string }) {
  const titleClass = level === 0 
    ? 'standard-section-title--1' 
    : level === 1 
      ? 'standard-section-title--2' 
      : level === 2 
        ? 'standard-section-title--3' 
        : 'standard-section-title--4'

  const sectionId = `${prefix}-${section.id}`

  return (
    <div id={sectionId} className="standard-section">
      <h3 className={`standard-section-title ${titleClass}`}>
        {section.id} {section.title}
      </h3>
      {section.content && (
        <div className="standard-section-content">
          {section.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
      {section.images && section.images.length > 0 && (
        <div className="standard-section-images">
          {section.images.map((image, index) => (
            <figure key={index} className="standard-figure">
              <img
                src={image.src}
                alt={image.caption}
                className="standard-image"
              />
              <figcaption className="standard-figcaption">{image.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {section.children && section.children.length > 0 && (
        <div className="standard-section-children">
          {section.children.map((child) => (
            <SectionContent key={child.id} section={child} level={level + 1} prefix={prefix} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 目录项组件（全部展开，不可折叠）
 */
function TocItem({
  section,
  level,
  activeId,
  onNavigate,
  prefix,
}: {
  section: Section
  level: number
  activeId: string
  onNavigate: (id: string) => void
  prefix: string
}) {
  const hasChildren = section.children && section.children.length > 0
  const sectionId = `${prefix}-${section.id}`
  const isActive = activeId === sectionId

  const handleClick = useCallback(() => {
    onNavigate(sectionId)
  }, [sectionId, onNavigate])

  return (
    <div className="standard-toc-item-wrapper">
      <div
        className={`standard-toc-item ${isActive ? 'standard-toc-item--active' : ''}`}
        style={{ paddingLeft: 12 + level * 16 }}
        onClick={handleClick}
      >
        <span className="standard-toc-text">
          {section.id} {section.title}
        </span>
      </div>
      {hasChildren && (
        <div className="standard-toc-children">
          {section.children.map((child) => (
            <TocItem
              key={child.id}
              section={child}
              level={level + 1}
              activeId={activeId}
              onNavigate={onNavigate}
              prefix={prefix}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function StandardModal({ onClose }: StandardModalProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [activeId, setActiveId] = useState('gb9704-1')
  const contentRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const currentStandard = standards[activeTab]
  const prefix = currentStandard.key

  /**
   * 切换规范页签
   */
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index)
    const newPrefix = standards[index].key
    setActiveId(`${newPrefix}-1`)
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [])

  /**
   * 导航到指定章节
   */
  const handleNavigate = useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element && contentRef.current) {
      const container = contentRef.current
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop + elementRect.top - containerRect.top - 20
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      })
      setActiveId(id)
    }
  }, [])

  /**
   * 设置 IntersectionObserver 监听滚动
   */
  useEffect(() => {
    if (!contentRef.current) return

    const flatSections = flattenSections(currentStandard.data)
    const sections = flatSections
      .map((s) => document.getElementById(`${prefix}-${s.id}`))
      .filter(Boolean)

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting)
        if (visibleEntries.length > 0) {
          const topEntry = visibleEntries.reduce((prev, current) => {
            const prevRect = prev.boundingClientRect
            const currentRect = current.boundingClientRect
            return currentRect.top < prevRect.top ? current : prev
          })
          const id = topEntry.target.id
          setActiveId(id)
        }
      },
      {
        root: contentRef.current,
        rootMargin: '-20px 0px -70% 0px',
        threshold: 0,
      }
    )

    sections.forEach((section) => {
      if (section) {
        observerRef.current.observe(section)
      }
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [activeTab, currentStandard.data, prefix])

  return (
    <div className="standard-overlay" onClick={onClose}>
      <div className="standard-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div className="standard-header">
          <h2 className="standard-title">{currentStandard.title}</h2>
          <span className="standard-subtitle">{currentStandard.subtitle}</span>
          <button className="standard-close" onClick={onClose} aria-label="关闭">
            x
          </button>
        </div>

        {/* 页签切换 */}
        <div className="standard-tabs">
          {standards.map((standard, index) => (
            <button
              key={standard.key}
              className={`standard-tab ${activeTab === index ? 'standard-tab--active' : ''}`}
              onClick={() => handleTabChange(index)}
            >
              {standard.subtitle}
            </button>
          ))}
        </div>

        <div className="standard-body">
          {/* 左侧目录 */}
          <div className="standard-toc">
            <div className="standard-toc-header">目录</div>
            <div className="standard-toc-content">
              {currentStandard.data.map((section) => (
                <TocItem
                  key={section.id}
                  section={section}
                  level={0}
                  activeId={activeId}
                  onNavigate={handleNavigate}
                  prefix={prefix}
                />
              ))}
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="standard-content" ref={contentRef}>
            {currentStandard.data.map((section) => (
              <SectionContent key={section.id} section={section} level={0} prefix={prefix} />
            ))}
          </div>
        </div>

        {/* 底部 */}
        <div className="standard-footer">
          <span className="standard-footer-note">{currentStandard.footer}</span>
          <button className="standard-btn standard-btn--close" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
