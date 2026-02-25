/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// 单文件模式：SINGLE_FILE=1 npm run build
const isSingleFile = !!process.env.SINGLE_FILE

// GitHub Pages 需要子路径前缀，Vercel / 本地开发使用根路径
// 单文件模式强制使用相对路径以支持离线双击打开
const base = isSingleFile ? './' : process.env.GITHUB_ACTIONS ? '/gongwen/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
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
