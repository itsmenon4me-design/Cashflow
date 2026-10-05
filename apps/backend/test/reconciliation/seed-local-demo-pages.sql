BEGIN;

DO $seed$
DECLARE
  target_user_id UUID;
  groceries_category_id UUID;
  transport_category_id UUID;
  income_category_id UUID;
  local_now TIMESTAMP WITHOUT TIME ZONE;
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

  INSERT INTO categories (
    id, user_id, name, type, description, is_system, is_active, created_at, updated_at
  )
  VALUES
    (gen_random_uuid(), target_user_id, '[DUMMY] Demo Groceries', 'EXPENSE',
      '[DUMMY] Category for local page demonstrations', false, true, now(), now()),
    (gen_random_uuid(), target_user_id, '[DUMMY] Demo Transport', 'EXPENSE',
      '[DUMMY] Category for local page demonstrations', false, true, now(), now()),
    (gen_random_uuid(), target_user_id, '[DUMMY] Demo Freelance Income', 'INCOME',
      '[DUMMY] Category for local page demonstrations', false, true, now(), now())
  ON CONFLICT (user_id, name, type) DO NOTHING;

  SELECT id INTO STRICT groceries_category_id
  FROM categories
  WHERE user_id = target_user_id
    AND name = '[DUMMY] Demo Groceries'
    AND type = 'EXPENSE'
    AND deleted_at IS NULL
    AND is_active;

  SELECT id INTO STRICT transport_category_id
  FROM categories
  WHERE user_id = target_user_id
    AND name = '[DUMMY] Demo Transport'
    AND type = 'EXPENSE'
    AND deleted_at IS NULL
    AND is_active;

  SELECT id INTO STRICT income_category_id
  FROM categories
  WHERE user_id = target_user_id
    AND name = '[DUMMY] Demo Freelance Income'
    AND type = 'INCOME'
    AND deleted_at IS NULL
    AND is_active;

  local_now := now() AT TIME ZONE 'Asia/Jakarta';

  WITH entries(category_id, transaction_type, amount_cents, local_date_time, note) AS (
    VALUES
      (groceries_category_id, 'EXPENSE'::"TransactionType", 185000::BIGINT,
        date_trunc('month', local_now) + interval '6 days 12 hours',
        '[DUMMY] Page demo groceries'),
      (transport_category_id, 'EXPENSE'::"TransactionType", 85000::BIGINT,
        date_trunc('month', local_now) + interval '20 days 8 hours',
        '[DUMMY] Page demo transport'),
      (income_category_id, 'INCOME'::"TransactionType", 750000::BIGINT,
        date_trunc('month', local_now) + interval '12 days 14 hours',
        '[DUMMY] Page demo freelance income'),
      (income_category_id, 'INCOME'::"TransactionType", 300000::BIGINT,
        date_trunc('day', local_now) + interval '10 hours 15 minutes',
        '[DUMMY] Page demo income today'),
      (groceries_category_id, 'EXPENSE'::"TransactionType", 50000::BIGINT,
        date_trunc('day', local_now) + interval '10 hours 20 minutes',
        '[DUMMY] Page demo expense today'),
      (income_category_id, 'INCOME'::"TransactionType", 1200000::BIGINT,
        date_trunc('month', local_now) - interval '2 months 10 days' + interval '11 hours',
        '[DUMMY] Page demo historical income'),
      (groceries_category_id, 'EXPENSE'::"TransactionType", 320000::BIGINT,
        date_trunc('month', local_now) - interval '2 months 18 days' + interval '17 hours',
        '[DUMMY] Page demo historical expense')
  )
  INSERT INTO transactions (
    id, user_id, category_id, transaction_type, amount_cents, transaction_date,
    note, created_at, updated_at
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
  FROM entries e
  WHERE NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.user_id = target_user_id
      AND t.note = e.note
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo transaction rows', inserted_count;

  INSERT INTO budgets (
    id, user_id, category_id, currency, budget_amount_cents, month, year, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), target_user_id, c.id, 'IDR', v.amount_cents,
    EXTRACT(MONTH FROM local_now)::INTEGER,
    EXTRACT(YEAR FROM local_now)::INTEGER,
    now(), now()
  FROM (
    VALUES
      (groceries_category_id, 2500000::BIGINT),
      (transport_category_id, 750000::BIGINT)
  ) AS v(category_id, amount_cents)
  JOIN categories c ON c.id = v.category_id
  WHERE NOT EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.user_id = target_user_id
      AND b.category_id = c.id
      AND b.month = EXTRACT(MONTH FROM local_now)::INTEGER
      AND b.year = EXTRACT(YEAR FROM local_now)::INTEGER
      AND b.deleted_at IS NULL
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo budget rows', inserted_count;

  INSERT INTO "Bill" (
    id, user_id, payee, amount_cents, currency, category_id, due_date,
    due_date_timezone, is_paid, status, recurrence_type, is_template,
    reminder_enabled, reminder_days_before, reminder_time, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), target_user_id, v.payee, v.amount_cents, 'IDR',
    v.category_id,
    ((date_trunc('day', local_now) + v.due_offset) AT TIME ZONE 'Asia/Jakarta')
      AT TIME ZONE 'UTC',
    'Asia/Jakarta', false, 'OPEN', v.recurrence_type::"BillRecurrence",
    false, true, 1, '09:00', now(), now()
  FROM (
    VALUES
      ('[DUMMY] Internet rumah', 450000::BIGINT, groceries_category_id,
        interval '5 days 9 hours', 'MONTHLY'),
      ('[DUMMY] Tagihan listrik', 325000::BIGINT, transport_category_id,
        interval '12 days 10 hours', 'NONE')
  ) AS v(payee, amount_cents, category_id, due_offset, recurrence_type)
  WHERE NOT EXISTS (
    SELECT 1 FROM "Bill" b
    WHERE b.user_id = target_user_id
      AND b.payee = v.payee
      AND b.deleted_at IS NULL
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo bill rows', inserted_count;

  INSERT INTO saving_goals (
    id, user_id, category_id, currency, name, description,
    target_amount_cents, current_amount_cents, start_date, target_date,
    status, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), target_user_id, v.category_id, 'IDR', v.name,
    '[DUMMY] Goal for local page demonstrations',
    v.target_amount_cents, v.current_amount_cents,
    ((date_trunc('day', local_now) - interval '30 days') AT TIME ZONE 'Asia/Jakarta')
      AT TIME ZONE 'UTC',
    ((date_trunc('day', local_now) + interval '90 days 23 hours 59 minutes')
      AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC',
    'ACTIVE', now(), now()
  FROM (
    VALUES
      ('[DUMMY] Dana darurat', groceries_category_id, 10000000::BIGINT, 2750000::BIGINT),
      ('[DUMMY] Liburan keluarga', transport_category_id, 6000000::BIGINT, 1800000::BIGINT)
  ) AS v(name, category_id, target_amount_cents, current_amount_cents)
  WHERE NOT EXISTS (
    SELECT 1 FROM saving_goals g
    WHERE g.user_id = target_user_id
      AND g.name = v.name
      AND g.deleted_at IS NULL
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo saving goal rows', inserted_count;

  INSERT INTO investments (
    id, user_id, currency, investment_type, platform, name, symbol,
    quantity, average_buy_price, current_price, invested_amount_cents,
    current_value_cents, profit_loss_cents, profit_loss_percentage,
    purchase_date, notes, status, created_at, updated_at
  )
  SELECT
    gen_random_uuid(), target_user_id, 'IDR', 'STOCK', 'Demo lokal',
    '[DUMMY] Contoh saham', 'DMY',
    10.00000000, 100000.000000, 110000.000000,
    1000000, 1100000, 100000, 10.00,
    ((date_trunc('day', local_now) - interval '60 days 3 hours')
      AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC',
    '[DUMMY] Investment for local page demonstrations',
    'ACTIVE', now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM investments i
    WHERE i.user_id = target_user_id
      AND i.name = '[DUMMY] Contoh saham'
      AND i.deleted_at IS NULL
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo investment rows', inserted_count;

  INSERT INTO notifications (
    id, user_id, type, title, message, is_read, dedupe_key, metadata, created_at, updated_at
  )
  VALUES
    (gen_random_uuid(), target_user_id, 'SYSTEM',
      '[DUMMY] Pengingat tagihan internet',
      '[DUMMY] Contoh notifikasi tagihan untuk pengujian lokal.',
      false, 'local-demo-pages-bill-reminder',
      jsonb_build_object('tag', '[DUMMY]'), now(), now()),
    (gen_random_uuid(), target_user_id, 'SYSTEM',
      '[DUMMY] Tujuan tabungan diperbarui',
      '[DUMMY] Contoh notifikasi tujuan untuk pengujian lokal.',
      false, 'local-demo-pages-goal-update',
      jsonb_build_object('tag', '[DUMMY]'), now(), now())
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % demo notification rows', inserted_count;
END
$seed$;

COMMIT;
