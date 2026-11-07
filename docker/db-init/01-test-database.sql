-- Runs once, when the database volume is first created.
-- The API tests use their own database so they never touch real data.
CREATE DATABASE vinit_test OWNER vinit;
