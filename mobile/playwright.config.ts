import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5194' },
  webServer: { command: 'npm run dev -- --port 5194 --strictPort', url: 'http://127.0.0.1:5194', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'small-phone', use: { viewport: { width: 320, height: 568 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
