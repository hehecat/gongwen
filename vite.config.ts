/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 需要子路径前缀，Vercel / 本地开发使用根路径
const base = process.env.GITHUB_ACTIONS ? '/gongwen/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
