USE oipp;

CREATE TABLE IF NOT EXISTS internship_listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  location VARCHAR(120) NULL,
  listing_type VARCHAR(40) NOT NULL DEFAULT 'Internship',
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_internship_listings_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  profile_snapshot JSON NOT NULL,
  resume_name VARCHAR(255) NOT NULL,
  resume_mime_type VARCHAR(127) NOT NULL,
  resume_file_size INT UNSIGNED NOT NULL,
  resume_data LONGBLOB NOT NULL,
  status ENUM('Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected')
    NOT NULL DEFAULT 'Applied',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_applications_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_listing
    FOREIGN KEY (listing_id) REFERENCES internship_listings(id) ON DELETE CASCADE,
  CONSTRAINT uq_applications_student_listing UNIQUE (student_id, listing_id),
  INDEX idx_applications_student_date (student_id, applied_at),
  INDEX idx_applications_listing_status (listing_id, status)
) ENGINE=InnoDB;
