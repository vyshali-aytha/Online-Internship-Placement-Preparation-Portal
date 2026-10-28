CREATE DATABASE IF NOT EXISTS oipp;
USE oipp;

CREATE TABLE IF NOT EXISTS mock_interview_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mock_interview_slot_time (starts_at, ends_at),
  INDEX idx_mock_interview_slots_starts_at (starts_at),
  CONSTRAINT chk_mock_interview_slot_times CHECK (ends_at > starts_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mock_interview_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slot_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  feedback TEXT NULL,
  feedback_by VARCHAR(255) NULL,
  feedback_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_mock_interview_booking_slot UNIQUE (slot_id),
  CONSTRAINT fk_mock_interview_booking_slot
    FOREIGN KEY (slot_id)
    REFERENCES mock_interview_slots(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mock_interview_booking_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE,
  INDEX idx_mock_interview_bookings_student (student_id)
) ENGINE=InnoDB;