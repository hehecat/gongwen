/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/gongwen/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
