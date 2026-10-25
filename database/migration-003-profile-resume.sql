USE oipp;

CREATE TABLE IF NOT EXISTS student_profiles (
  student_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  phone VARCHAR(30) NULL,
  location VARCHAR(120) NULL,
  headline VARCHAR(160) NULL,
  bio TEXT NULL,
  cgpa DECIMAL(4,2) NULL,
  skills TEXT NULL,
  projects TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_profiles_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_student_profiles_cgpa CHECK (cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10))
);

CREATE TABLE IF NOT EXISTS student_resumes (
  student_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(127) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  file_data LONGBLOB NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_resumes_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
