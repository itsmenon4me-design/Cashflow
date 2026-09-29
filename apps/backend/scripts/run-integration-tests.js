const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '..', '.env.test');
const loaded = dotenv.config({ path: envPath, override: false });

if (loaded.error) {
  console.error(`Unable to load test environment from ${envPath}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
let databaseName = '';
let hasTestMarker = false;
let hasUnsafeMarker = false;

try {
  const url = new URL(databaseUrl);
  databaseName = decodeURIComponent(url.pathname.slice(1));
  hasTestMarker = /(?:^|[_-])test(?:$|[_-])/i.test(databaseName);
  hasUnsafeMarker =
    /(?:^|[_-])(?:dev|development|local|prod|production)(?:$|[_-])/i.test(
      databaseName,
    );
} catch {
  console.error('Invalid or missing DATABASE_URL in the test environment.');
  process.exit(1);
}

const maskedName =
  databaseName.length > 1
    ? `${databaseName[0]}${'*'.repeat(Math.min(databaseName.length - 1, 8))}`
    : '***';
console.log(
  `Integration DB: ${maskedName}; has_test_marker=${hasTestMarker}`,
);

if (
  databaseName !== 'cashflow_test' ||
  !hasTestMarker ||
  hasUnsafeMarker
) {
  console.error('Refusing integration tests for a non-isolated database.');
  process.exit(1);
}

const jestBin = require.resolve('jest/bin/jest');
const tests = [
  'src/modules/transactions/transactions.integration.spec.ts',
  'src/modules/reports/reports.integration.spec.ts',
];
const result = spawnSync(
  process.execPath,
  [jestBin, '--runInBand', '--runTestsByPath', ...tests],
  { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' },
);

if (result.error) {
  console.error(`Unable to start Jest: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
