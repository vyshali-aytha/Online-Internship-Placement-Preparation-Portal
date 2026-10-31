USE oipp;

-- OIPP-F-016: recruiter-owned listings with a draft/publish step.
-- Extends the existing internship_listings table (migration-004-applications.sql).
-- Run once. Existing listings keep status OPEN and have no recruiter (recruiter_id NULL).

ALTER TABLE internship_listings
  MODIFY status ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN recruiter_id INT NULL AFTER id,
  ADD COLUMN min_cgpa DECIMAL(4,2) NULL AFTER listing_type,
  ADD CONSTRAINT fk_listings_recruiter
    FOREIGN KEY (recruiter_id) REFERENCES recruiter_requests(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_listings_min_cgpa
    CHECK (min_cgpa IS NULL OR (min_cgpa >= 0 AND min_cgpa <= 10)),
  ADD INDEX idx_listings_recruiter (recruiter_id);
