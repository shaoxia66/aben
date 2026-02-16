import type { PoolClient } from "pg";

export type PgAgentTask = {
  id: string;
  tenantId: string;
  sessionId: string;
  sessionTitle: string | null;
  parentTaskId: string | null;
  orderNo: number;
  title: string;
  goal: string | null;
  acceptanceCriteria: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  lifecycle: "open" | "blocked" | "canceled" | "closed";
  assignedClientId: string | null;
  idempotencyKey: string | null;
  input: unknown;
  output: unknown;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export type PgAgentTaskRun = {
  id: string;
  tenantId: string;
  taskId: string;
  runNo: number;
  clientId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export type PgAgentTaskEvent = {
  id: string;
  tenantId: string;
  sessionId: string;
  taskId: string | null;
  runId: string | null;
  type: string;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  extra: unknown;
};

export async function listAgentTasksByTenantId(
  client: PoolClient,
  params: {
    tenantId: string;
    sessionId?: string;
    lifecycle?: PgAgentTask["lifecycle"];
    status?: PgAgentTask["status"];
    limit: number;
  }
): Promise<PgAgentTask[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    session_title: string | null;
    parent_task_id: string | null;
    order_no: number;
    title: string;
    goal: string | null;
    acceptance_criteria: string | null;
    status: PgAgentTask["status"];
    lifecycle: PgAgentTask["lifecycle"];
    assigned_client_id: string | null;
    idempotency_key: string | null;
    input: unknown;
    output: unknown;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT",
      "t.id,",
      "t.tenant_id,",
      "t.session_id,",
      "s.title as session_title,",
      "t.parent_task_id,",
      "t.order_no,",
      "t.title,",
      "t.goal,",
      "t.acceptance_criteria,",
      "t.status,",
      "t.lifecycle,",
      "t.assigned_client_id,",
      "t.idempotency_key,",
      "t.input,",
      "t.output,",
      "t.created_at,",
      "t.updated_at,",
      "t.extra",
      "FROM agent_tasks t",
      "LEFT JOIN agent_sessions s ON s.tenant_id = t.tenant_id AND s.id = t.session_id",
      "WHERE t.tenant_id = $1",
      "AND ($2::uuid IS NULL OR t.session_id = $2)",
      "AND ($3::text IS NULL OR t.lifecycle = $3)",
      "AND ($4::text IS NULL OR t.status = $4)",
      "ORDER BY t.updated_at DESC, t.created_at DESC, t.order_no ASC",
      "LIMIT $5"
    ].join(" "),
    [
      params.tenantId,
      params.sessionId ?? null,
      params.lifecycle ?? null,
      params.status ?? null,
      params.limit
    ]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    parentTaskId: row.parent_task_id,
    orderNo: row.order_no,
    title: row.title,
    goal: row.goal,
    acceptanceCriteria: row.acceptance_criteria,
    status: row.status,
    lifecycle: row.lifecycle,
    assignedClientId: row.assigned_client_id,
    idempotencyKey: row.idempotency_key,
    input: row.input ?? {},
    output: row.output ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}

export async function findAgentTaskById(
  client: PoolClient,
  params: { tenantId: string; taskId: string }
): Promise<PgAgentTask | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    session_title: string | null;
    parent_task_id: string | null;
    order_no: number;
    title: string;
    goal: string | null;
    acceptance_criteria: string | null;
    status: PgAgentTask["status"];
    lifecycle: PgAgentTask["lifecycle"];
    assigned_client_id: string | null;
    idempotency_key: string | null;
    input: unknown;
    output: unknown;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT",
      "t.id,",
      "t.tenant_id,",
      "t.session_id,",
      "s.title as session_title,",
      "t.parent_task_id,",
      "t.order_no,",
      "t.title,",
      "t.goal,",
      "t.acceptance_criteria,",
      "t.status,",
      "t.lifecycle,",
      "t.assigned_client_id,",
      "t.idempotency_key,",
      "t.input,",
      "t.output,",
      "t.created_at,",
      "t.updated_at,",
      "t.extra",
      "FROM agent_tasks t",
      "LEFT JOIN agent_sessions s ON s.tenant_id = t.tenant_id AND s.id = t.session_id",
      "WHERE t.tenant_id = $1 AND t.id = $2",
      "LIMIT 1"
    ].join(" "),
    [params.tenantId, params.taskId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    parentTaskId: row.parent_task_id,
    orderNo: row.order_no,
    title: row.title,
    goal: row.goal,
    acceptanceCriteria: row.acceptance_criteria,
    status: row.status,
    lifecycle: row.lifecycle,
    assignedClientId: row.assigned_client_id,
    idempotencyKey: row.idempotency_key,
    input: row.input ?? {},
    output: row.output ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  };
}

export async function listAgentTaskRunsByTaskId(
  client: PoolClient,
  params: { tenantId: string; taskId: string; limit: number }
): Promise<PgAgentTaskRun[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    task_id: string;
    run_no: number;
    client_id: string;
    status: PgAgentTaskRun["status"];
    input_snapshot: unknown;
    output_snapshot: unknown;
    error: string | null;
    started_at: Date | null;
    finished_at: Date | null;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, task_id, run_no, client_id, status, input_snapshot, output_snapshot, error, started_at, finished_at, created_at, updated_at, extra",
      "FROM agent_task_runs",
      "WHERE tenant_id = $1 AND task_id = $2",
      "ORDER BY run_no DESC",
      "LIMIT $3"
    ].join(" "),
    [params.tenantId, params.taskId, params.limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    runNo: row.run_no,
    clientId: row.client_id,
    status: row.status,
    inputSnapshot: row.input_snapshot ?? {},
    outputSnapshot: row.output_snapshot ?? {},
    error: row.error,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}

export async function listAgentTaskEventsByTaskId(
  client: PoolClient,
  params: { tenantId: string; taskId: string; limit: number }
): Promise<PgAgentTaskEvent[]> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    task_id: string | null;
    run_id: string | null;
    type: string;
    payload: unknown;
    occurred_at: Date;
    created_at: Date;
    updated_at: Date;
    extra: unknown;
  }>(
    [
      "SELECT id, tenant_id, session_id, task_id, run_id, type, payload, occurred_at, created_at, updated_at, extra",
      "FROM agent_task_events",
      "WHERE tenant_id = $1 AND task_id = $2",
      "ORDER BY occurred_at DESC",
      "LIMIT $3"
    ].join(" "),
    [params.tenantId, params.taskId, params.limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    taskId: row.task_id,
    runId: row.run_id,
    type: row.type,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    extra: row.extra ?? {}
  }));
}
