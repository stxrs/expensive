import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Adjust the base if your repo name differs from "expensive"
export default defineConfig({
  plugins: [react()],
  base: '/expensive/',
  build: { outDir: 'dist' }
});
