import { copyFileSync, existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAVICON_SRC = resolve(
  __dirname,
  "../../assets/favicons/D_FAV_2.svg",
);

/** Single source: repo-root assets/favicons/D_FAV_2.svg → /favicon.svg in dev + dist. */
function faviconFromRepoAssets(): Plugin {
  return {
    name: "favicon-from-repo-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = req.url?.split("?")[0];
        if (pathOnly === "/favicon.svg") {
          res.setHeader("Content-Type", "image/svg+xml");
          res.end(readFileSync(FAVICON_SRC));
          return;
        }
        next();
      });
    },
    closeBundle() {
      if (existsSync(FAVICON_SRC)) {
        copyFileSync(FAVICON_SRC, resolve(__dirname, "dist/favicon.svg"));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || "https://api.dempsey.agency";

  return {
    plugins: [react(), faviconFromRepoAssets()],
    server: {
      port: 5173,
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
