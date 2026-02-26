-- Add indexes on foreign key columns for better JOIN/cascade performance (Supabase lint 0001)

CREATE INDEX IF NOT EXISTS links_source_node_id_idx ON public.links(source_node_id);
CREATE INDEX IF NOT EXISTS links_target_node_id_idx ON public.links(target_node_id);
CREATE INDEX IF NOT EXISTS node_invites_node_id_idx ON public.node_invites(node_id);
