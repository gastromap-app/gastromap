import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Strips console.* calls in production builds to reduce bundle size
 * and prevent leaking debug logs to end users.
 */
function removeConsolePlugin() {
  return {
    name: 'remove-console',
    transform(code, id) {
      if (process.env.NODE_ENV !== 'production') return null
      if (!/\.(js|jsx|ts|tsx)$/.test(id)) return null
      if (id.includes('node_modules')) return null

      // Remove console.* calls (but keep console.error in case we want them)
      const cleaned = code.replace(/console\.(log|warn|info|debug|trace)\([^)]*\);?/g, '')
      return cleaned === code ? null : { code: cleaned, map: null }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    removeConsolePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon-192.png', 'pwa-icon-512.png', 'offline.html'],
      manifest: {
        name: 'GastroMap — Smart AI Dining Guide',
        short_name: 'GastroMap',
        description: 'Discover the best restaurants with AI. Your personal gastronomic expert.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['food', 'lifestyle', 'travel'],
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Precache: только JS/CSS/HTML бандлы (без картинок — они тяжёлые и меняются)
        // iOS Safari лимит: 50MB. Chrome: без лимита, но зачем занимать?
        // Целевой размер кэша: < 10MB
        globPatterns: ['**/*.{js,css,html}', 'offline.html'],
        navigateFallback: 'index.html',
        // Файлы > 3MB не кэшируем (защита от больших чанков)
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Автоматически чистим кэш от старых версий при обновлении SW
        cleanupOutdatedCaches: true,
        // SW сразу берёт управление без ожидания перезагрузки
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // ─── Google Fonts CSS — кэш на год, меняется редко ──────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Google Fonts files ─────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Supabase Storage (фото локаций) — небольшой кэш ───────────────────
          // Только 20 последних просмотренных, чтобы уложиться в iOS лимит
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 20,               // ~20 фото × ~200KB = ~4MB
                maxAgeSeconds: 60 * 60 * 24 * 3  // 3 дня
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Supabase REST — NetworkFirst (свежие данные важнее кэша) ──────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 30,               // ~30 запросов, небольшие JSON
                maxAgeSeconds: 60 * 60 * 2    // 2 часа
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── AI chat — никогда не кэшировать ───────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/ai-chat/i,
            handler: 'NetworkOnly'
          },
          // ─── Edge functions (kg-save, etc) — только сеть ───────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkOnly'
          },
          // ─── Карты CartoDB — НЕ кэшируем (тайлы = главный виновник 1.4GB) ──────
          // Карта без сети бесполезна, а тайлы весят сотни МБ
          // Если нужен оффлайн-вид — использовать vector tiles через MapLibre
          {
            urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'NetworkOnly'
          },
          // ─── Vercel API — NetworkFirst, короткий кэш ───────────────────────────
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vercel-api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'react-core'
          }
          if (id.includes('node_modules/react-router-dom/') || id.includes('node_modules/react-router/') || id.includes('node_modules/@remix-run/router/')) {
            return 'react-router'
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'framer-motion'
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'lucide'
          }
          if (id.includes('node_modules/leaflet/') || id.includes('node_modules/react-leaflet/')) {
            return 'leaflet'
          }
          if (id.includes('node_modules/i18next/') || id.includes('node_modules/react-i18next/') || id.includes('node_modules/i18next-browser-languagedetector/')) {
            return 'i18n'
          }
          if (id.includes('node_modules/@tanstack/')) {
            return 'tanstack'
          }
          // admin pages are lazy-loaded — let Vite split them automatically
        }
      }
    },
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    exclude: ['.claude/**', '**/.claude/worktrees/**', 'coverage/**', 'dist/**', 'node_modules/**'],
  },
})
