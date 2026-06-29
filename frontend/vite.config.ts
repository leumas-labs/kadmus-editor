import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Generates relative paths so dist/index.html loads assets cleanly over file://
});
