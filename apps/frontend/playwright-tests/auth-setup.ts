import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Manual auth setup: login once, save storageState.json
 * Run: npx tsx playwright-tests/auth-setup.ts
 */

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question(prompt, () => resolve());
  });
  rl.close();
}

async function setup() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Opening http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login');

  console.log('\n=== LOGIN MANUALLY ===');
  console.log('1. Login dengan credentials valid');
  console.log('2. Tunggu sampai redirect ke /dashboard');
  console.log('3. Kembali ke terminal, tekan Enter\n');

  await waitForEnter('Tekan Enter setelah login sukses... ');

  // Validasi: harus sudah keluar dari halaman login
  const url = page.url();
  if (url.includes('/login')) {
    console.error(`✗ Masih di halaman login (${url}). Login dulu sebelum Enter.`);
    await browser.close();
    process.exit(1);
  }

  // Ambil state ke memori dulu, lalu validasi isinya
  const state = await context.storageState();
  const cookieCount = state.cookies.length;
  const originCount = state.origins.length;
  if (cookieCount === 0 && originCount === 0) {
    console.error('✗ Storage state KOSONG (0 cookies, 0 origins). Login belum persist.');
    await browser.close();
    process.exit(1);
  }

  // Tulis manual dengan path absolut (relatif terhadap folder file ini)
  const outPath = path.resolve(__dirname, 'storageState.json');
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2), 'utf-8');

  const size = fs.statSync(outPath).size;
  console.log(`✓ storageState.json saved: ${outPath}`);
  console.log(`  cookies=${cookieCount}, origins=${originCount}, size=${size} bytes`);

  await browser.close();
  process.exit(0);
}

setup().catch((err) => {
  console.error('✗ Setup gagal:', err);
  process.exit(1);
});
