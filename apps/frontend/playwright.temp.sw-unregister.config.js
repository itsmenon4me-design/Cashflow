// Temporary Playwright config for SW-unregister single-test runs
module.exports = {
  testDir: './playwright',
  testMatch: /multi-currency-acceptance\.sw-unregister\.spec\.ts$/,
  timeout: 120000,
  use: {
    headless: false,
    trace: 'on'
  },
  fullyParallel: false,
  workers: 1,
};
