USE oipp;

CREATE TABLE IF NOT EXISTS mock_test_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,
  score INT UNSIGNED NULL,
  total_questions INT UNSIGNED NOT NULL DEFAULT 10,
  answers JSON NULL,
  CONSTRAINT fk_mock_test_attempts_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE,
  INDEX idx_mock_test_student_date (student_id, started_at)
);