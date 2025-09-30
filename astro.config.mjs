import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: {
    name: 'astro-server',
    hooks: {
      'astro:config:setup': ({ addMiddleware }) => {
        // Configuración para manejar archivos estáticos
      }
    }
  }
});
