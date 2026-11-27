import { useEffect, useState } from 'react'
import alipayQr from '../assets/alipay.png'
import wechatQr from '../assets/wechat.png'
import { SegmentedControl } from './FormControls'
import { CloseIcon, ShieldCheckIcon } from './icons'

interface SpecAboutModalProps {
  onClose: () => void
}

export function SpecAboutModal({ onClose }: SpecAboutModalProps) {
  const [tab, setTab] = useState<'spec' | 'about'>('spec')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="cb-modal-backdrop cb-no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cb-modal cb-modal--lg"
        role="dialog"
        aria-modal="true"
        aria-label="GB/T 9704—2012 国标速查与关于"
      >
        <header className="cb-modal-head">
          <div>
            <h2 className="cb-modal-title">GB/T 9704—2012《党政机关公文格式》参考与关于</h2>
            <p className="cb-modal-sub">
              国家标准排版尺寸对照速查 · 纯前端本地离线公文工作台
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close"
            aria-label="关闭"
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="cb-modal-toolbar">
          <SegmentedControl<'spec' | 'about'>
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'spec', label: 'GB/T 9704—2012 核心规范速查' },
              { value: 'about', label: '关于工作台与更新记录' },
            ]}
          />
        </div>

        <div className="cb-modal-body">
          {tab === 'spec' ? (
            <div className="cb-spec-grid">
              <div className="cb-spec-block">
                <h3 className="cb-spec-title">一、纸张幅面与版心网格（§5）</h3>
                <dl className="cb-spec-dl cb-tabular">
                  <div>
                    <dt>成品幅面</dt>
                    <dd>A4 型纸 210 mm × 297 mm</dd>
                  </div>
                  <div>
                    <dt>页边标准</dt>
                    <dd>天头 3.7 cm · 下白边 3.5 cm · 订口 2.8 cm · 右白边 2.6 cm</dd>
                  </div>
                  <div>
                    <dt>版心尺寸</dt>
                    <dd>156 mm × 225 mm（不含页码）</dd>
                  </div>
                  <div>
                    <dt>行数字数</dt>
                    <dd>每面 22 行 × 每行 28 字，固定行距约 28.9 磅</dd>
                  </div>
                </dl>
              </div>

              <div className="cb-spec-block">
                <h3 className="cb-spec-title">二、字级与层次序数体系（§7.3）</h3>
                <dl className="cb-spec-dl cb-tabular">
                  <div>
                    <dt>公文标题</dt>
                    <dd>2 号方正小标宋体（22pt），居中排布，末尾不加句号</dd>
                  </div>
                  <div>
                    <dt>正文段落</dt>
                    <dd>3 号仿宋体（16pt），首行左空二字，两端对齐</dd>
                  </div>
                  <div>
                    <dt>四级层次</dt>
                    <dd>
                      「一、」黑体 → 「（一）」楷体 → 「1.」仿宋 → 「（1）」仿宋
                    </dd>
                  </div>
                  <div>
                    <dt>版记与页码</dt>
                    <dd>版记 4 号仿宋（首末 0.35mm 粗线）；页码 4 号半角宋体单右双左</dd>
                  </div>
                </dl>
              </div>

              <div className="cb-spec-block">
                <h3 className="cb-spec-title">三、四类法定公文版式要点（§7 & §10）</h3>
                <dl className="cb-spec-dl">
                  <div>
                    <dt>通用红头（§7）</dt>
                    <dd>红色发文机关标志下空二行居中排发文字号（六角括号〔〕），下 4mm 印红色分隔线。</dd>
                  </div>
                  <div>
                    <dt>上行文（§7.2.6）</dt>
                    <dd>发文字号居左空一字，签发人（「签发人：」仿宋+姓名楷体）居右空一字同行排列，居中红星分隔线。</dd>
                  </div>
                  <div>
                    <dt>信函格式（§10.1）</dt>
                    <dd>标志距上边 30mm，上下印 170mm 武文双红线；首页不印页码；版记不印印发机关与分隔线。</dd>
                  </div>
                  <div>
                    <dt>命令与纪要（§10.2/10.3）</dt>
                    <dd>命令居中排令号并支持签发人签名章；纪要支持「出席/请假/列席」3 号黑体标签悬挂回行对齐。</dd>
                  </div>
                </dl>
              </div>

              <div className="cb-spec-block">
                <h3 className="cb-spec-title">四、高频规范易错点（内置校对自动覆盖）</h3>
                <ul className="cb-spec-list">
                  <li>发文字号年份须用六角括号 <code>〔2026〕</code>，顺序号不加“第”字、不编虚位（如不写 <code>01号</code>）。</li>
                  <li>成文日期用阿拉伯数字标全年月日，月、日不编虚位（如 <code>2026年4月6日</code>）。</li>
                  <li>附件说明在正文下空一行左空二字，附件名称末尾不加任何标点符号。</li>
                  <li>成文日期与机关署名不得单独印在最后一页（“孤行落款”），可由本工具求解器自动微调行距消除。</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="cb-about-pane">
              <div className="cb-about-hero">
                <div className="cb-about-meta-row">
                  <span className="cb-about-ver cb-tabular">{__APP_VERSION__}</span>
                  <span className="cb-about-mode-pill">
                    {__IS_SINGLE_FILE__ ? '单文件便携离线版' : 'PWA 本地离线工作台'}
                  </span>
                </div>

                <div className="cb-privacy-card">
                  <ShieldCheckIcon size={18} className="cb-privacy-icon" />
                  <div>
                    <div className="cb-privacy-title">100% 本地离线运行 · 严守公文数据安全</div>
                    <div className="cb-privacy-desc">
                      所有公文原稿、自定义红头图片与版式模板均在您的本机浏览器内完成解析、分页与 Word 打包，零后端接口、零网络上传，可在涉密内网或无网络环境下通过单文件 HTML 直接双击运行。
                    </div>
                  </div>
                </div>
              </div>

              {__APP_RECENT_UPDATES__.length > 0 && (
                <div className="cb-about-section">
                  <div className="cb-subhead">近期版本更新记录</div>
                  <ul className="cb-updates-list cb-tabular">
                    {__APP_RECENT_UPDATES__.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="cb-about-section">
                <div className="cb-subhead">赞赏支持独立维护</div>
                <p className="cb-about-sponsor-note">
                  如果这款工具为您省去了繁琐的公文调格时间，欢迎扫码请作者喝杯热茶：
                </p>
                <div className="cb-qr-grid">
                  <figure className="cb-qr-card">
                    <img src={wechatQr} alt="微信赞赏码" />
                    <figcaption>微信赞赏</figcaption>
                  </figure>
                  <figure className="cb-qr-card">
                    <img src={alipayQr} alt="支付宝赞赏码" />
                    <figcaption>支付宝支持</figcaption>
                  </figure>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
