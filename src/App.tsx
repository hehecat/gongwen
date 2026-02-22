import { useState, useCallback } from 'react'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { Toolbar } from './components/Toolbar/Toolbar'
import { useDocumentParser } from './hooks/useDocumentParser'
import { useDocumentConfig } from './contexts/DocumentConfigContext'
import { downloadDocx } from './exporter'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const ast = useDocumentParser(text)
  const { config } = useDocumentConfig()

  const handleExport = useCallback(async () => {
    try {
      await downloadDocx(ast, config)
    } catch (err) {
      console.error('导出失败:', err)
      alert('导出失败，请检查控制台日志')
    }
  }, [ast, config])

  const handleClear = useCallback(() => {
    setText('')
  }, [])

  return (
    <div className="app">
      <Toolbar ast={ast} onExport={handleExport} onClear={handleClear} />
      <div className="app-main">
        <div className="app-editor">
          <Editor value={text} onChange={setText} />
        </div>
        <div className="app-preview">
          <Preview ast={ast} />
        </div>
      </div>
    </div>
  )
}

export default App
