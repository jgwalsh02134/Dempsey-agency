import { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || "https://api.dempsey.agency";

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
