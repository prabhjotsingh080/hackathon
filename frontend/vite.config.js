import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_API_URL is injected at build time from the environment.
// Set it in Vercel's project settings (or .env.local for local dev).
// All variables prefixed with VITE_ are automatically exposed to the client
// via import.meta.env — no extra config needed.
export default defineConfig({
  plugins: [react()],
  envPrefix: 'VITE_',   // explicit (Vite default — documented here for clarity)
  server: {
    port: 3000,
    open: true,
  },
})
