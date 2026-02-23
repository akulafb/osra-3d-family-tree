ALTER TABLE links DROP CONSTRAINT IF EXISTS links_type_check;
ALTER TABLE links ADD CONSTRAINT links_type_check CHECK (type IN ('parent', 'marriage', 'divorce'));

-- Update Hisham & Hala link
UPDATE links 
SET type = 'divorce' 
WHERE source_node_id = '10000000-1000-4000-8000-00000000001b' 
  AND target_node_id = '10000000-1000-4000-8000-000000000018';
