import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei', 'react-force-graph-3d', 'three-spritetext'],
          'vendor-d3': ['d3-drag', 'd3-hierarchy', 'd3-selection', 'd3-shape', 'd3-zoom'],
          'vendor-motion': ['motion'],
        },
      },
    },
  },
})
