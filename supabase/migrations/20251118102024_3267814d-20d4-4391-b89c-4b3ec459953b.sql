-- Add shift column to employees table
ALTER TABLE employees ADD COLUMN shift TEXT DEFAULT 'Skift 1';

-- Add index for better query performance
CREATE INDEX idx_employees_shift ON employees(shift);