import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// 把单个主题打包成一个可以双击打开的 index.html（脚本和样式全部内联）
// 用法：VITE_THEME=islands OUT_DIR=成品/E-浮空群岛 vite build -c vite.standalone.config.ts
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: process.env.OUT_DIR || 'dist-standalone',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
})
