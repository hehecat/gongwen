import { useState } from 'react'
import alipayQr from '../../assets/alipay.png'
import wechatQr from '../../assets/wechat.png'
import { ModalDialog } from '../common/ModalDialog'
import './AboutSpecModal.css'

interface AboutSpecModalProps {
  open: boolean
  onClose: () => void
}

const PROJECT_INFO = {
  repoUrl: 'https://github.com/hehecat/gongwen',
  releasesUrl: 'https://github.com/hehecat/gongwen/releases',
  authorEmail: 'hehecat@outlook.com',
  recentUpdates: __APP_RECENT_UPDATES__,
}

const DONATION_QR_CODES = [
  { label: '支付宝', src: alipayQr },
  { label: '微信', src: wechatQr },
]

export function AboutSpecModal({ open, onClose }: AboutSpecModalProps) {
  const [tab, setTab] = useState<'spec' | 'about'>('spec')
  const displayVersion = __APP_VERSION__.split('-')[0]

  return (
    <ModalDialog
      open={open}
      title="GB/T 9704—2012 速查与关于"
      subtitle={`纯前端本地离线公文排版工具 · 当前版本 v${displayVersion}`}
      maxWidth={580}
      onClose={onClose}
      footer={(
        <button type="button" className="about-btn" onClick={onClose}>
          关闭
        </button>
      )}
    >
      <div className="about-stack">
        <div className="about-tabs" role="tablist" aria-label="信息分组">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'spec'}
            className={`about-tab ${tab === 'spec' ? 'about-tab--active' : ''}`}
            onClick={() => setTab('spec')}
          >
            国标参数速查
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'about'}
            className={`about-tab ${tab === 'about' ? 'about-tab--active' : ''}`}
            onClick={() => setTab('about')}
          >
            关于与离线版
          </button>
        </div>

        {tab === 'spec' ? (
          <div className="about-spec-wrap">
            <table className="about-spec-table">
              <thead>
                <tr>
                  <th>公文要素</th>
                  <th>GB/T 9704—2012 标准规定</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>用纸与版心</td>
                  <td>A4 (210×297 mm)；天头 37 mm / 订口 28 mm / 版心 156×225 mm</td>
                </tr>
                <tr>
                  <td>版面行数</td>
                  <td>一般每面 22 行、每行 28 字（约 28.9 pt 固定行距）</td>
                </tr>
                <tr>
                  <td>公文标题</td>
                  <td>2 号小标宋体居中，红色分隔线下空二行</td>
                </tr>
                <tr>
                  <td>正文与层级</td>
                  <td>3 号仿宋；一、黑体 /（一）楷体 / 1. 仿宋 /（1）仿宋</td>
                </tr>
                <tr>
                  <td>印章与日期</td>
                  <td>加盖印章：日期右空四字；不加盖：空一行、日期右空二字</td>
                </tr>
                <tr>
                  <td>版记与页码</td>
                  <td>4 号仿宋（0.35 mm / 0.25 mm 线）；页码 4 号宋体单右双左距底 7 mm</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="about-info-card">
            <div className="about-links">
              <div>
                <span className="about-label">开源仓库：</span>
                <a href={PROJECT_INFO.repoUrl} target="_blank" rel="noopener noreferrer">{PROJECT_INFO.repoUrl}</a>
              </div>
              <div>
                <span className="about-label">单文件离线版：</span>
                <a
                  href="https://github.com/hehecat/gongwen/releases/latest/download/gongwen.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  下载 gongwen.html（双击即用）
                </a>
                {' · '}
                <a href={PROJECT_INFO.releasesUrl} target="_blank" rel="noopener noreferrer">
                  全部 Releases
                </a>
              </div>
              <div>
                <span className="about-label">联系作者：</span>
                <a href={`mailto:${PROJECT_INFO.authorEmail}`}>{PROJECT_INFO.authorEmail}</a>
              </div>
            </div>

            {PROJECT_INFO.recentUpdates.length > 0 && (
              <div className="about-updates">
                <span className="about-label">近期更新记录</span>
                <ul>
                  {PROJECT_INFO.recentUpdates.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="about-donate">
              <span className="about-label">打赏支持作者</span>
              <div className="about-donate-row">
                {DONATION_QR_CODES.map((qr) => (
                  <figure key={qr.label} className="about-donate-card">
                    <img
                      className="about-donate-image"
                      src={qr.src}
                      alt={`${qr.label}收款码`}
                      width={112}
                      height={112}
                      loading="lazy"
                    />
                    <figcaption>{qr.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  )
}
