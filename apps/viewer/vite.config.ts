import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      routeRules: {
        '/proxy-fonts/**': {
          proxy: 'https://design.penpot.app/**',
        },
      },
    }),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
});

export default config;
