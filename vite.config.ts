/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// 单文件模式：SINGLE_FILE=1 npm run build
const isSingleFile = !!process.env.SINGLE_FILE

// GitHub Pages 需要子路径前缀，Vercel / 本地开发使用根路径
// 单文件模式强制使用相对路径以支持离线双击打开
const base = isSingleFile ? './' : process.env.GITHUB_ACTIONS ? '/gongwen/' : '/'

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function readPackageVersion(): string {
  const packageJsonPath = new URL('./package.json', import.meta.url)
  const packageInfo = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string }
  return packageInfo.version ?? '0.0.0'
}

function readGitShortSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

function normalizeCommitSubject(subject: string): string {
  return subject.replace(/^\w+(?:\([^)]*\))?!?:\s*/, '').trim()
}

function readRecentUpdates(limit = 5): string[] {
  try {
    const output = execSync(
      `git log -n ${limit} --date=format:'%Y-%m-%d' --pretty=format:'%ad%x09%s'`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .toString()
      .trim()

    if (!output) return []

    return output
      .split('\n')
      .map((line) => {
        const [date, subject = ''] = line.split('\t')
        return `${date}: ${normalizeCommitSubject(subject)}`
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

const packageVersion = readPackageVersion()
const gitShortSha = readGitShortSha()
const releaseStyleVersion = gitShortSha ? `v${formatDate(new Date())}-${gitShortSha}` : packageVersion
const recentUpdates = readRecentUpdates()
// 与 release.yml 的 TAG 规则保持一致；支持用 APP_VERSION 显式覆盖
const appVersion = process.env.APP_VERSION?.trim() || releaseStyleVersion

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_RECENT_UPDATES__: JSON.stringify(recentUpdates),
  },
  plugins: [
    react(),
    ...(isSingleFile
      ? [viteSingleFile({ removeViteModuleLoader: true })]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: '公文排版工具',
              short_name: '公文排版',
              description: '符合 GB/T 9704 标准的公文排版与导出工具',
              theme_color: '#c0392b',
              background_color: '#ffffff',
              display: 'standalone',
              scope: base,
              start_url: base,
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            },
          }),
        ]),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
