DO $seed$
DECLARE
  target_user_id UUID;
  expense_category_id UUID;
  income_category_id UUID;
  inserted_count INTEGER;
BEGIN
  IF current_database() <> 'cashflow' THEN
    RAISE EXCEPTION 'Refusing to seed outside the local cashflow database';
  END IF;

  SELECT u.id
    INTO STRICT target_user_id
  FROM users u
  JOIN user_settings s ON s.user_id = u.id
  WHERE lower(u.email) = lower('admin@cashflow.local')
    AND u.status = 'ACTIVE'
    AND s.timezone = 'Asia/Jakarta';

  IF EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.user_id = target_user_id
      AND t.note LIKE '[DUMMY]%'
  ) THEN
    RAISE EXCEPTION 'Dummy rows already exist for the test account; refusing duplicate seed';
  END IF;

  SELECT c.id
    INTO STRICT expense_category_id
  FROM categories c
  WHERE c.user_id = target_user_id
    AND c.name = 'Food'
    AND c.type = 'EXPENSE'
    AND c.deleted_at IS NULL
    AND c.is_active;

  SELECT c.id
    INTO STRICT income_category_id
  FROM categories c
  WHERE c.user_id = target_user_id
    AND c.name = 'Salary'
    AND c.type = 'INCOME'
    AND c.deleted_at IS NULL
    AND c.is_active;

  WITH local_clock AS (
    SELECT now() AT TIME ZONE 'Asia/Jakarta' AS local_now
  ),
  entries(category_id, transaction_type, amount_cents, local_date_time, note) AS (
    SELECT expense_category_id, 'EXPENSE'::"TransactionType", 125000::BIGINT,
           date_trunc('day', local_now) + interval '10 hours',
           '[DUMMY] Today 10:00 WIB expense'
    FROM local_clock
    UNION ALL
    SELECT expense_category_id, 'EXPENSE'::"TransactionType", 50000::BIGINT,
           date_trunc('month', local_now) - interval '1 day' + interval '23 hours 59 minutes',
           '[DUMMY] Previous month last day 23:59 WIB expense'
    FROM local_clock
    UNION ALL
    SELECT income_category_id, 'INCOME'::"TransactionType", 500000::BIGINT,
           date_trunc('month', local_now) + interval '30 minutes',
           '[DUMMY] This month day 1 00:30 WIB income'
    FROM local_clock
    UNION ALL
    SELECT income_category_id, 'INCOME'::"TransactionType", 1000000::BIGINT,
           date_trunc('month', local_now) + interval '14 days 12 hours',
           '[DUMMY] This month additional income'
    FROM local_clock
    UNION ALL
    SELECT expense_category_id, 'EXPENSE'::"TransactionType", 250000::BIGINT,
           date_trunc('month', local_now) + interval '19 days 18 hours',
           '[DUMMY] This month additional expense'
    FROM local_clock
  )
  INSERT INTO transactions (
    id,
    user_id,
    category_id,
    transaction_type,
    amount_cents,
    transaction_date,
    note,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    target_user_id,
    e.category_id,
    e.transaction_type,
    e.amount_cents,
    (e.local_date_time AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC',
    e.note,
    now() AT TIME ZONE 'UTC',
    now() AT TIME ZONE 'UTC'
  FROM entries e;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 5 THEN
    RAISE EXCEPTION 'Expected to insert 5 dummy rows, inserted %', inserted_count;
  END IF;

  RAISE NOTICE 'Inserted % dummy transaction rows for the existing local account', inserted_count;
END
$seed$;
