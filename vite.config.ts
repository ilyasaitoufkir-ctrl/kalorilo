import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all JS/CSS chunks aggressively — they're content-hashed
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Runtime cache for API calls and external resources
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/wger\.de\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'wger-api', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
      manifest: {
        name: 'Kalorilo – Kalorienzähler',
        short_name: 'Kalorilo',
        description: 'Dein smarter KI-Ernährungsbegleiter',
        theme_color: '#4a8c5c',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],

  build: {
    // Raise warning threshold – we know about it; chunking handles it
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always needed, loads first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          // Firebase — large, but only needed after auth check
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'vendor-firebase'
          }
          // Recharts — only loaded when Statistics or RunSummary tab opens
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts'
          }
          // Leaflet + map — only loaded when run map opens
          if (id.includes('node_modules/leaflet')) {
            return 'vendor-leaflet'
          }
          // ZXing barcode scanner — heavy, only when barcode scanner opens
          if (id.includes('node_modules/@zxing/')) {
            return 'vendor-zxing'
          }
          // Lucide icons — used everywhere but can be split from app logic
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          // Everything else in node_modules → vendor-misc
          if (id.includes('node_modules/')) {
            return 'vendor-misc'
          }
        },
      },
    },
  },

  server: {
    host: true,
  },
})
