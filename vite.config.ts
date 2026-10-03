import {glob} from 'glob';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(
    ({command}) => ({
      base: command === 'build' ? '/' : '/',
      root: './src',
      publicDir: '../public',
      build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
          // this finds all the html files, but filters any file ending in '-template.html'
          input:
              glob.sync('**/*.html', {cwd: './src'})
                  .filter((f) => !f.endsWith('-template.html') && f !== 'gallery/album/index.html'),
        },
      },
    }));