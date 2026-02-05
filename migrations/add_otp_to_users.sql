-- Migration: Add OTP fields to users table
-- This allows storing OTP directly in the users table instead of using a separate password_resets table

ALTER TABLE users 
ADD COLUMN otp VARCHAR(6) NULL,
ADD COLUMN otp_expires_at DATETIME NULL;

-- Optional: Drop password_resets table if it exists and is no longer needed
-- DROP TABLE IF EXISTS password_resets;
