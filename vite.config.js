import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

// Build ID for cache busting — changes on every build
const BUILD_ID = `build-${Date.now()}`

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  plugins: [
    react(),
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
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Google Fonts files ─────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Cloudflare R2 (фото локаций) — CacheFirst с длинным TTL ──────────
          // R2 photos are immutable (filename includes timestamp), so CacheFirst is safe.
          // WebP format, ~80-120KB per photo.
          {
            urlPattern: /^https:\/\/pub-[a-z0-9]+\.r2\.dev\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'r2-photos-cache',
              expiration: {
                maxEntries: 30,               // 30 фото × ~100KB (webp) = ~3MB
                maxAgeSeconds: 60 * 60 * 24 * 30,  // 30 дней (immutable files)
                purgeOnQuotaError: true
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Supabase Storage (geo-covers, avatars) — сжатый кэш ──────────────
          // Only used for geo-covers and avatars now (location photos moved to R2).
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 10,               // 10 фото × ~200KB (webp) = ~2MB
                maxAgeSeconds: 60 * 60 * 24 * 3,  // 3 дня
                purgeOnQuotaError: true       // Автоочистка при нехватке места
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
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,               // ~30 запросов, небольшие JSON
                maxAgeSeconds: 60 * 60 * 2,   // 2 часа
                purgeOnQuotaError: true
              },
              cacheableResponse: { statuses: [200] }
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
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 15, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
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
          if (id.includes('node_modules/gsap/')) {
            return 'gsap'
          }
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
            return 'recharts'
          }
          // Zustand + shared state management
          if (id.includes('node_modules/zustand/')) {
            return 'zustand'
          }
          // Supabase client — used everywhere but heavy
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase'
          }
          // Headless UI + Radix — UI primitives
          if (id.includes('node_modules/@headlessui/') || id.includes('node_modules/@radix-ui/')) {
            return 'ui-primitives'
          }
          // Stripe — only needed on pricing/payment pages
          if (id.includes('node_modules/@stripe/')) {
            return 'stripe'
          }
          // OGL (3D) — only used on landing
          if (id.includes('node_modules/ogl/')) {
            return 'ogl'
          }
          // Lenis smooth scroll — only landing pages
          if (id.includes('node_modules/lenis/')) {
            return 'lenis'
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
