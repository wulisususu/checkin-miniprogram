CREATE DATABASE IF NOT EXISTS checkin_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE checkin_prod;

CREATE TABLE IF NOT EXISTS checkin_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  photo_url VARCHAR(512) NOT NULL,
  checkin_time DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_openid_time (openid, checkin_time),
  KEY idx_checkin_time (checkin_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

