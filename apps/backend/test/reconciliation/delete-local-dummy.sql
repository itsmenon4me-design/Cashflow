BEGIN;

DO $cleanup$
DECLARE
  target_user_id UUID;
  deleted_count INTEGER;
BEGIN
  IF current_database() <> 'cashflow' THEN
    RAISE EXCEPTION 'Refusing cleanup outside the local cashflow database';
  END IF;

  SELECT u.id
    INTO STRICT target_user_id
  FROM users u
  WHERE lower(u.email) = lower('admin@cashflow.local')
    AND u.status = 'ACTIVE';

  IF EXISTS (
    SELECT 1
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE c.user_id = target_user_id
      AND c.name LIKE '[DUMMY]%'
      AND t.note NOT LIKE '[DUMMY]%'
  ) THEN
    RAISE EXCEPTION 'Refusing to remove demo categories linked to non-dummy transactions';
  END IF;

  DELETE FROM transactions
  WHERE user_id = target_user_id
    AND note LIKE '[DUMMY]%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy transaction rows', deleted_count;

  DELETE FROM notifications
  WHERE user_id = target_user_id
    AND (
      title LIKE '[DUMMY]%'
      OR message LIKE '[DUMMY]%'
      OR dedupe_key LIKE 'local-demo-pages-%'
      OR metadata::text LIKE '%[DUMMY]%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy notification rows', deleted_count;

  DELETE FROM investments
  WHERE user_id = target_user_id
    AND (name LIKE '[DUMMY]%' OR notes LIKE '[DUMMY]%');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy investment rows', deleted_count;

  DELETE FROM saving_goals
  WHERE user_id = target_user_id
    AND (name LIKE '[DUMMY]%' OR description LIKE '[DUMMY]%');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy saving goal rows', deleted_count;

  DELETE FROM "Bill"
  WHERE user_id = target_user_id
    AND (
      payee LIKE '[DUMMY]%'
      OR category_id IN (
        SELECT id FROM categories
        WHERE user_id = target_user_id AND name LIKE '[DUMMY]%'
      )
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy bill rows', deleted_count;

  DELETE FROM budgets
  WHERE user_id = target_user_id
    AND category_id IN (
      SELECT id FROM categories
      WHERE user_id = target_user_id AND name LIKE '[DUMMY]%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy budget rows', deleted_count;

  DELETE FROM categories
  WHERE user_id = target_user_id
    AND name LIKE '[DUMMY]%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % dummy category rows', deleted_count;
END
$cleanup$;

COMMIT;
