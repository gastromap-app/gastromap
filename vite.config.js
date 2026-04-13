import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon-192.png', 'pwa-icon-512.png'],
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
        // Only cache JS/CSS/HTML — not images (they are fetched fresh or via runtimeCaching)
        globPatterns: ['**/*.{js,css,html}'],
        navigateFallback: 'index.html',
        // Total precache size limit: 5 MB (warn if exceeded)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // ─── Google Fonts CSS ──────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Google Fonts files ────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Unsplash images — reduced limit + size cap ────────────────────────────
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images-cache',
              expiration: {
                maxEntries: 20,               // было 60 → 20
                maxAgeSeconds: 60 * 60 * 24 * 14  // было 30 дней → 14
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Avatars ───────────────────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/i\.pravatar\.cc\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatar-images-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Supabase REST API — NetworkFirst ──────────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,               // было 100 → 50
                maxAgeSeconds: 60 * 60 * 6    // было 24h → 6h
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Supabase Storage (location images) ────────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 50,               // было 200 → 50
                maxAgeSeconds: 60 * 60 * 24 * 7  // было 30 дней → 7
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Map tiles — жёсткий лимит ─────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 100,              // было 500 → 100 (главный виновник!)
                maxAgeSeconds: 60 * 60 * 24 * 3  // было 7 дней → 3
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ─── Semantic search edge function ────────────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/semantic-search/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'edge-semantic-search-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 10 },
              cacheableResponse: { statuses: [200] }
            }
          },
          // ─── AI chat — never cache ─────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/ai-chat/i,
            handler: 'NetworkOnly'
          },
          // ─── KG save — never cache ────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/kg-save/i,
            handler: 'NetworkOnly'
          },
          // ─── Brave search API ─────────────────────────────────────────────────────
          {
            urlPattern: /\/api\/brave-search/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'brave-search-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 30 },
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
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'react-router': ['react-router-dom'],
          'framer-motion': ['framer-motion'],
          'lucide': ['lucide-react'],
          'leaflet': ['leaflet', 'react-leaflet'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-virtual'],
          'admin': [
            '/src/features/admin/layout/AdminLayout.jsx',
            '/src/features/admin/pages/AdminDashboardPage.jsx',
            '/src/features/admin/pages/AdminLocationsPage.jsx',
            '/src/features/admin/pages/AdminUsersPage.jsx',
            '/src/features/admin/pages/AdminSubscriptionsPage.jsx',
            '/src/features/admin/pages/AdminModerationPage.jsx',
            '/src/features/admin/pages/AdminAIPage.jsx',
            '/src/features/admin/pages/AdminKnowledgeGraphPage.jsx',
            '/src/features/admin/pages/AdminNotificationsPage.jsx',
            '/src/features/admin/pages/AdminStatsPage.jsx',
            '/src/features/admin/pages/AdminSettingsPage.jsx',
            '/src/features/admin/components/ImportWizard.jsx',
            '/src/features/admin/components/LocationHierarchyExplorer.jsx',
          ],
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
  },
})
