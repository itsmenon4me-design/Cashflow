// Temporary Playwright config for targeted single-test runs
module.exports = {
  testDir: './playwright',
  testMatch: /multi-currency-acceptance\.reports-analytics\.spec\.ts$/,
  timeout: 120000,
  use: {
    headless: true,
    trace: 'on'
  },
  fullyParallel: false,
  workers: 1,
};
