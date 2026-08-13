# Benchmark write run - reads

- timestamp: 2026-08-13T12:19:44.954Z
- group: reads
- target: http://localhost:3001/api/v1
- total requests: 200
- concurrency: 5

## Summary

- total: 200
- successes: 150
- failures: 50
- error_rate: 0.25
- status distribution: {"200":150,"404":50}
- error categories: {"not_found":50,"other":150}

## Sample errors

### HTTP 404
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
