-- Additive migration for F-002/F-003 only. Existing student rows remain unchanged.
ALTER TABLE students
  ADD COLUMN failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN locked_until DATETIME NULL;

CREATE INDEX idx_students_locked_until ON students (locked_until);
