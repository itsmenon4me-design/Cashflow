# Benchmark write run - reads

- timestamp: 2026-08-13T12:18:24.823Z
- group: reads
- target: http://localhost:3001/api/v1
- total requests: 200
- concurrency: 5

## Summary

- total: 200
- successes: 0
- failures: 200
- error_rate: 1
- status distribution: {"401":150,"404":50}
- error categories: {"unauthorized":150,"not_found":50}

## Sample errors

### HTTP 401
- Unauthorized
- Unauthorized
- Unauthorized
- Unauthorized
- Unauthorized
### HTTP 404
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
- Cannot GET /api/v1/reports
