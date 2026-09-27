# Dashboard balance and cash flow KPIs

## Requirements
- While a user has recorded transactions, the dashboard shall show current balance as all active income minus all active expenses for that user.
- While viewing a month, the dashboard shall show income, expense, and net cash flow for that month only.
- While viewing a month, the dashboard shall compare its net cash flow with the previous calendar month's net cash flow.
- The dashboard shall not introduce an opening balance or any bank or wallet integration.

## Architecture
- Frontend: Keep the four existing KPI cards. Render the cash-flow difference as a signed amount using the existing comparison label. Keep positive/negative meaning while using text colors with sufficient contrast in light and dark themes.
- Backend: Extend the authenticated summary response with previous-month net cash flow; calculate lifetime balance and calendar-month aggregates from active, user-scoped transactions.
- Security: Use the authenticated user ID and parameterized Prisma filters scoped to `user_id` and `deleted_at: null`. Do not expose transaction-level data.

## Implementation plan
- [x] Separate the lifetime balance from current-month income, expense, and net cash flow.
- [x] Include the previous calendar month's net cash flow in the summary response.
- [x] Render the signed monthly difference on the existing cash-flow KPI.
- [x] Add regression tests for database scoping, calendar boundaries, and KPI display.
