import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: 'src/manifest.json', dest: '.' },
        { src: 'public/icon.svg', dest: '.' },
        // Removed { src: 'background', dest: '.' }, as background script is now in src/background.js
        // If you want to copy the background script, add:
        { src: 'src/background.js', dest: '.' },
        { src: 'src/utils/scheduler.js', dest: 'utils' }, // Changed dest from 'background/utils' to 'utils'
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
