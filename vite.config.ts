import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 监听 0.0.0.0 是给容器用的:只有绑定到 0.0.0.0,
// 宿主机浏览器才能通过映射端口访问到容器里的 Vite。
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
