import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Cada vista de la app se empaqueta en un solo HTML (JS y CSS inline): el host
// la sirve como recurso MCP, sin servidor de assets propio.
const INPUT = process.env.INPUT;
if (!INPUT) throw new Error("Falta INPUT: el HTML de la vista a empaquetar");
const desarrollo = process.env.NODE_ENV === "development";

export default defineConfig({
  root: "src/ui",
  plugins: [viteSingleFile()],
  build: {
    sourcemap: desarrollo ? "inline" : undefined,
    cssMinify: !desarrollo,
    minify: !desarrollo,
    rollupOptions: { input: path.resolve(INPUT) },
    outDir: path.resolve("dist"),
    emptyOutDir: false,
  },
});
