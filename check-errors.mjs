import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', error => {
    errors.push(error.toString());
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n=== CONSOLE LOGS ===');
  logs.forEach(log => console.log(log));

  console.log('\n=== PAGE ERRORS ===');
  errors.forEach(err => console.log(err));

  // Check if canvas exists
  const canvas = await page.$('canvas');
  console.log('\n=== CANVAS ===');
  console.log('Canvas exists:', !!canvas);

  if (canvas) {
    const rect = await canvas.boundingBox();
    console.log('Canvas size:', rect);
  }

  await browser.close();
})();
