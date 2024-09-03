import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // We do this for GitHub pages
    outDir: "docs",
  },
});
