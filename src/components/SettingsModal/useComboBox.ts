import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

interface UseComboBoxOptions {
  blurOnCommit?: boolean
  blurOnEscape?: boolean
  itemCount: number
  onOpen?: () => void
  onCommit: () => void
  onSelect: (index: number) => void
  onEscape?: () => void
}

export function useComboBox({
  blurOnCommit = false,
  blurOnEscape = false,
  itemCount,
  onOpen,
  onCommit,
  onSelect,
  onEscape,
}: UseComboBoxOptions) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mouseDownOnWrapRef = useRef(false)
  const callbacksRef = useRef({ onCommit, onEscape, onOpen, onSelect })
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  useEffect(() => {
    callbacksRef.current = { onCommit, onEscape, onOpen, onSelect }
  }, [onCommit, onEscape, onOpen, onSelect])

  function closeDropdown() {
    setOpen(false)
    setActiveIdx(-1)
  }

  function openDropdown() {
    callbacksRef.current.onOpen?.()
    setOpen(true)
    setActiveIdx(-1)
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        callbacksRef.current.onCommit()
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleWrapMouseDown() {
    mouseDownOnWrapRef.current = true
  }

  function handleWrapClick() {
    if (open) {
      callbacksRef.current.onCommit()
      closeDropdown()
      return
    }
    openDropdown()
    inputRef.current?.focus()
  }

  function handleFocus() {
    if (mouseDownOnWrapRef.current) {
      mouseDownOnWrapRef.current = false
      return
    }
    if (!open) openDropdown()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (itemCount > 0) {
          setActiveIdx((prev) => (prev < itemCount - 1 ? prev + 1 : 0))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (itemCount > 0) {
          setActiveIdx((prev) => (prev > 0 ? prev - 1 : itemCount - 1))
        }
        break
      case 'Enter':
        e.preventDefault()
        if (activeIdx >= 0 && activeIdx < itemCount) {
          callbacksRef.current.onSelect(activeIdx)
        } else {
          callbacksRef.current.onCommit()
          if (blurOnCommit) {
            inputRef.current?.blur()
          }
        }
        closeDropdown()
        break
      case 'Escape':
        e.preventDefault()
        callbacksRef.current.onEscape?.()
        closeDropdown()
        if (blurOnEscape) {
          inputRef.current?.blur()
        }
        break
    }
  }

  return {
    activeIdx,
    closeDropdown,
    handleFocus,
    handleKeyDown,
    handleWrapClick,
    handleWrapMouseDown,
    inputRef,
    open,
    setActiveIdx,
    setOpen,
    wrapRef,
  }
}
