import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for 3D scene to load
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'page-screenshot.png', fullPage: true });
  console.log('Screenshot saved to page-screenshot.png');

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Check console errors
  page.on('console', msg => console.log('Browser console:', msg.text()));

  await browser.close();
})();
