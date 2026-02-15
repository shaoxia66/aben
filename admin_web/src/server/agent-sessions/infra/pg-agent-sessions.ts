import type { PoolClient } from "pg";

export type PgAgentSession = {
  id: string;
  tenantId: string;
  clientIds: string[];
  title: string | null;
  status: "active" | "closed" | "archived";
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export type PgAgentMessage = {
  id: string;
  tenantId: string;
  sessionId: string;
  seq: number;
  authorType: "agent" | "system" | "tool";
  authorId: string | null;
  content: string | null;
  contentJson: unknown;
  replyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export async function lockAgentSessionForMessageAppend(
  client: PoolClient,
  params: { tenantId: string; sessionId: string }
) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM agent_sessions WHERE tenant_id = $1 AND id = $2 FOR UPDATE",
    [params.tenantId, params.sessionId]
  );

  return result.rows[0]?.id ?? null;
}

export async function getNextAgentMessageSeq(
  client: PoolClient,
  params: { tenantId: string; sessionId: string }
) {
  const result = await client.query<{ next_seq: number }>(
    "SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM agent_messages WHERE tenant_id = $1 AND session_id = $2",
    [params.tenantId, params.sessionId]
  );

  return result.rows[0]?.next_seq ?? 1;
}

export async function createAgentMessageRow(
  client: PoolClient,
  params: {
    tenantId: string;
    sessionId: string;
    seq: number;
    authorType: PgAgentMessage["authorType"];
    authorId: string | null;
    content: string | null;
    contentJson: unknown;
    replyToMessageId?: string | null;
    extra?: unknown;
  }
): Promise<PgAgentMessage> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    seq: number;
    author_type: PgAgentMessage["authorType"];
    author_id: string | null;
    content: string | null;
    content_json: unknown;
    reply_to_message_id: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "INSERT INTO agent_messages (tenant_id, session_id, seq, author_type, author_id, content, content_json, reply_to_message_id, extra)",
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      "RETURNING id, tenant_id, session_id, seq, author_type, author_id, content, content_json, reply_to_message_id, created_at, updated_at, extra"
    ].join(" "),
    [
      params.tenantId,
      params.sessionId,
      params.seq,
      params.authorType,
      params.authorId,
      params.content,
      params.contentJson ?? {},
      params.replyToMessageId ?? null,
      params.extra ?? {}
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    seq: row.seq,
    authorType: row.author_type,
    authorId: row.author_id,
    content: row.content,
    contentJson: row.content_json ?? {},
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function touchAgentSessionLastMessageAt(
  client: PoolClient,
  params: { tenantId: string; sessionId: string; lastMessageAt: Date }
) {
  await client.query(
    "UPDATE agent_sessions SET last_message_at = $1 WHERE tenant_id = $2 AND id = $3",
    [params.lastMessageAt, params.tenantId, params.sessionId]
  );
}

export async function listAgentSessionsByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<PgAgentSession[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_ids: string[];
    title: string | null;
    status: PgAgentSession["status"];
    last_message_at: Date | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, client_ids, title, status, last_message_at, created_at, updated_at, extra",
      "FROM agent_sessions",
      "WHERE tenant_id = $1",
      "ORDER BY COALESCE(last_message_at, created_at) DESC"
    ].join(" "),
    [tenantId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    clientIds: row.client_ids ?? [],
    title: row.title,
    status: row.status,
    lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}

export async function createAgentSessionRow(
  client: PoolClient,
  params: {
    tenantId: string;
    clientIds: string[];
    title: string | null;
  }
): Promise<PgAgentSession> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    client_ids: string[];
    title: string | null;
    status: PgAgentSession["status"];
    last_message_at: Date | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "INSERT INTO agent_sessions (tenant_id, client_ids, title, status, last_message_at)",
      "VALUES ($1, $2::uuid[], $3, 'active', NULL)",
      "RETURNING id, tenant_id, client_ids, title, status, last_message_at, created_at, updated_at, extra"
    ].join(" "),
    [params.tenantId, params.clientIds, params.title]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientIds: row.client_ids ?? [],
    title: row.title,
    status: row.status,
    lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function listAgentMessagesBySessionId(
  client: PoolClient,
  params: { tenantId: string; sessionId: string; limit: number }
): Promise<PgAgentMessage[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    seq: number;
    author_type: PgAgentMessage["authorType"];
    author_id: string | null;
    content: string | null;
    content_json: unknown;
    reply_to_message_id: string | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, session_id, seq, author_type, author_id, content, content_json, reply_to_message_id, created_at, updated_at, extra",
      "FROM agent_messages",
      "WHERE tenant_id = $1 AND session_id = $2",
      "ORDER BY seq ASC",
      "LIMIT $3"
    ].join(" "),
    [params.tenantId, params.sessionId, params.limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    seq: row.seq,
    authorType: row.author_type,
    authorId: row.author_id,
    content: row.content,
    contentJson: row.content_json ?? {},
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}
