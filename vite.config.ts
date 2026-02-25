/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

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
    ...(isSingleFile ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
  ],
  test: {
    globals: true,
    environment: 'node',
  },
})
