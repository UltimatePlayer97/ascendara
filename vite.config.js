import MillionLint from "@million/lint";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";
import pkg from "./package.json";

const plugins = [react()];
plugins.unshift(MillionLint.vite());

// https://vitejs.dev/config/
export default defineConfig({
  plugins: plugins,
  publicDir: path.join(__dirname, "src/public"),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_REVISION__: JSON.stringify(execSync("git rev-parse HEAD").toString()),
  },
  root: path.join(__dirname, "src"),
  base: process.env.ELECTRON == "true" ? "./" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api/igdb": {
        target: "https://api.igdb.com/v4",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/igdb/, ""),
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from the Target:",
              proxyRes.statusCode,
              req.url
            );
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
  },
  build: {
    copyPublicDir: true,
    outDir: path.join(__dirname, "src/dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, "src/index.html"),
    },
    assetsDir: "assets",
    sourcemap: true,
  },
});
