import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const readGitValue = (command: string, fallback = "unknown") => {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
};

const buildTimestamp = new Date().toISOString();
const commitSha = readGitValue("git rev-parse --short=12 HEAD");
const branchName = readGitValue("git branch --show-current");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __GIT_BRANCH__: JSON.stringify(branchName),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: "VORA",
        short_name: "VORA",
        description: "High-End Personal AI Stylist",
        theme_color: "#f4f6f0",
        background_color: "#f4f6f0",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web", "onnxruntime-web/webgpu"],
  },
  build: {
    rollupOptions: {
      external: ["onnxruntime-web", "onnxruntime-web/webgpu"],
    },
  },
  assetsInclude: ["**/*.wasm"],
}));
