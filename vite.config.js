import { defineConfig } from "vite";

export default defineConfig({
  base: "/prosemirror_experiments/",
  build: {
    // We do this for GitHub pages
    outDir: "docs",
  },
});
