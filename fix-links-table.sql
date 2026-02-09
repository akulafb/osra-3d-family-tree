-- ============================================================================
-- FIX: ADD MISSING COLUMN TO LINKS TABLE
-- ============================================================================
-- The links table was missing created_by_user_id, causing Add Relative to fail.

-- 1. Add the column
ALTER TABLE links 
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id);

-- 2. Update existing links to be owned by an admin (optional, for existing data)
-- If you have an admin user ID, you can set it here. For now we leave it null.

-- 3. Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'links';
