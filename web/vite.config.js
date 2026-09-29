import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 빌드 결과는 ../site 로 나가고 server.py 가 그 폴더를 서빙한다(없으면 기존 docs/).
// base: "./" 라 어디에 올려도(하위 경로 포함) 동작한다 — 정적 배포용.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "../site", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8765" },
  },
});
