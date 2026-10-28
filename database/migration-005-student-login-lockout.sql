CREATE DATABASE IF NOT EXISTS oipp;
USE oipp;

SET @oipp_has_failed_login_attempts = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'students'
    AND COLUMN_NAME = 'failed_login_attempts'
);
SET @oipp_lockout_sql = IF(
  @oipp_has_failed_login_attempts = 0,
  'ALTER TABLE students ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE oipp_lockout_stmt FROM @oipp_lockout_sql;
EXECUTE oipp_lockout_stmt;
DEALLOCATE PREPARE oipp_lockout_stmt;

SET @oipp_has_locked_until = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'students'
    AND COLUMN_NAME = 'locked_until'
);
SET @oipp_locked_until_sql = IF(
  @oipp_has_locked_until = 0,
  'ALTER TABLE students ADD COLUMN locked_until DATETIME NULL',
  'SELECT 1'
);
PREPARE oipp_locked_until_stmt FROM @oipp_locked_until_sql;
EXECUTE oipp_locked_until_stmt;
DEALLOCATE PREPARE oipp_locked_until_stmt;