import type { Session } from '@supabase/supabase-js';

function requireAdmin(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new Error('This action is only available to administrators.');
  }
}

function baseHeaders(session: Session | null): HeadersInit {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const authToken = session?.access_token || supabaseKey;
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${authToken}`,
  };
}

function messageFromErrorBody(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { message?: string; error?: string; hint?: string };
    if (j.message) return String(j.message);
    if (j.error) return String(j.error);
    if (j.hint) return String(j.hint);
  } catch {
    /* ignore */
  }
  return text || `Request failed (${status})`;
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  return messageFromErrorBody(text, response.status);
}

export async function adminDeleteNode(params: {
  session: Session | null;
  isAdmin: boolean;
  nodeId: string;
}): Promise<void> {
  requireAdmin(params.isAdmin);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_delete_node_secure`, {
    method: 'POST',
    headers: {
      ...baseHeaders(params.session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_node_id: params.nodeId }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromErrorBody(text, res.status));
  }
  let payload: { success?: boolean; message?: string };
  try {
    payload = text ? (JSON.parse(text) as { success?: boolean; message?: string }) : {};
  } catch {
    throw new Error('Unexpected response when deleting node.');
  }
  if (!payload.success) {
    throw new Error(
      payload.message ||
        'Could not delete this node. Confirm your account has role admin in the database.'
    );
  }
}

export async function adminInsertNode(params: {
  session: Session | null;
  isAdmin: boolean;
  body: {
    first_name: string;
    paternal_family_cluster?: string | null;
    maternal_family_cluster?: string | null;
    created_by_user_id: string;
  };
}): Promise<void> {
  requireAdmin(params.isAdmin);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/rest/v1/nodes`, {
    method: 'POST',
    headers: {
      ...baseHeaders(params.session),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(params.body),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function adminInsertLink(params: {
  session: Session | null;
  isAdmin: boolean;
  body: {
    source_node_id: string;
    target_node_id: string;
    type: 'parent' | 'marriage' | 'divorce';
    parent_role?: 'mother' | 'father' | null;
    created_by_user_id: string;
  };
}): Promise<void> {
  requireAdmin(params.isAdmin);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const payload = {
    ...params.body,
    parent_role: params.body.parent_role ?? null,
  };
  const res = await fetch(`${supabaseUrl}/rest/v1/links`, {
    method: 'POST',
    headers: {
      ...baseHeaders(params.session),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function adminPatchLink(params: {
  session: Session | null;
  isAdmin: boolean;
  linkId: string;
  body: Partial<{
    source_node_id: string;
    target_node_id: string;
    type: 'parent' | 'marriage' | 'divorce';
    parent_role: 'mother' | 'father' | null;
  }>;
}): Promise<void> {
  requireAdmin(params.isAdmin);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const lid = encodeURIComponent(params.linkId);
  const res = await fetch(`${supabaseUrl}/rest/v1/links?id=eq.${lid}`, {
    method: 'PATCH',
    headers: {
      ...baseHeaders(params.session),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(params.body),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function adminDeleteLink(params: {
  session: Session | null;
  isAdmin: boolean;
  linkId: string;
}): Promise<void> {
  requireAdmin(params.isAdmin);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const lid = encodeURIComponent(params.linkId);
  const res = await fetch(`${supabaseUrl}/rest/v1/links?id=eq.${lid}`, {
    method: 'DELETE',
    headers: {
      ...baseHeaders(params.session),
      Prefer: 'return=representation',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(messageFromErrorBody(text, res.status));
  }
  let rows: unknown[] = [];
  try {
    rows = text ? (JSON.parse(text) as unknown[]) : [];
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      'No link was deleted. Confirm your account has role admin in the database, then refresh and try again.'
    );
  }
}
