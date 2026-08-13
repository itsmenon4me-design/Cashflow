# Benchmark write run - auth

- timestamp: 2026-08-13T12:19:43.189Z
- group: auth
- target: http://localhost:3001/api/v1
- total requests: 200
- concurrency: 5

## Summary

- total: 200
- successes: 0
- failures: 200
- error_rate: 1
- status distribution: {"400":5,"403":195}
- error categories: {"validation":5,"forbidden":195}

## Sample errors

### HTTP 400
- Validation failed
- Validation failed
- Validation failed
- Validation failed
- Validation failed
### HTTP 403
- Forbidden resource
- Forbidden resource
- Forbidden resource
- Forbidden resource
- Forbidden resource
