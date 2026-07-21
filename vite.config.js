import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Allow Vercel / v0 cloud sandbox hosts (e.g. sb-xxxx.vercel.run) to reach the
  // Vite dev + preview server. The leading dot matches any subdomain.
  // localhost / 127.0.0.1 are always allowed regardless of this list.
  server: { allowedHosts: ['.vercel.run'] },
  preview: { allowedHosts: ['.vercel.run'] },
});
