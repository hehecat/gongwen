import './Editor.css'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export function Editor({ value, onChange }: EditorProps) {
  return (
    <div className="editor-container">
      <div className="editor-header">
        <span className="editor-label">粘贴公文正文</span>
        <span className="editor-hint">首行自动识别为标题，后续自动识别各级标题</span>
      </div>
      <textarea
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`关于XXX的通知\n\n一、总体要求\n为深入贯彻落实……\n（一）指导思想\n坚持以……\n1.加强组织领导\n（1）制定实施方案\n各部门要……`}
        spellCheck={false}
      />
    </div>
  )
}
