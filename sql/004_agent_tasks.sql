CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,

  parent_task_id UUID,
  order_no INTEGER DEFAULT 0 NOT NULL,

  title VARCHAR(255) NOT NULL,
  goal TEXT,
  acceptance_criteria TEXT,

  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  lifecycle VARCHAR(20) DEFAULT 'open' NOT NULL,

  assigned_client_id UUID,
  idempotency_key VARCHAR(200),

  input JSONB DEFAULT '{}'::jsonb NOT NULL,
  output JSONB DEFAULT '{}'::jsonb NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_tasks_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  CONSTRAINT agent_tasks_lifecycle_check CHECK (lifecycle IN ('open', 'blocked', 'canceled', 'closed'))
);

CREATE UNIQUE INDEX idx_agent_tasks_session_id_idempotency_key
ON agent_tasks(session_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_agent_tasks_tenant_id ON agent_tasks(tenant_id);
CREATE INDEX idx_agent_tasks_tenant_session_id ON agent_tasks(tenant_id, session_id);
CREATE INDEX idx_agent_tasks_session_id ON agent_tasks(session_id);
CREATE INDEX idx_agent_tasks_parent_task_id ON agent_tasks(parent_task_id);
CREATE INDEX idx_agent_tasks_tenant_status ON agent_tasks(tenant_id, status);
CREATE INDEX idx_agent_tasks_tenant_lifecycle ON agent_tasks(tenant_id, lifecycle);
CREATE INDEX idx_agent_tasks_assigned_client_id ON agent_tasks(assigned_client_id);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at);
CREATE INDEX idx_agent_tasks_extra ON agent_tasks USING GIN (extra);

CREATE TRIGGER update_agent_tasks_updated_at
BEFORE UPDATE ON agent_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_tasks IS 'Agent 会话任务表（会话内任务拆分、分派、编排）';
COMMENT ON COLUMN agent_tasks.id IS '主键';
COMMENT ON COLUMN agent_tasks.tenant_id IS '租户 ID';
COMMENT ON COLUMN agent_tasks.session_id IS '会话 ID（对应 agent_sessions.id；不建外键）';
COMMENT ON COLUMN agent_tasks.parent_task_id IS '父任务 ID（用于拆分/树形任务；不建外键）';
COMMENT ON COLUMN agent_tasks.order_no IS '同级任务顺序';
COMMENT ON COLUMN agent_tasks.title IS '任务标题';
COMMENT ON COLUMN agent_tasks.goal IS '任务目标描述';
COMMENT ON COLUMN agent_tasks.acceptance_criteria IS '验收标准';
COMMENT ON COLUMN agent_tasks.status IS '执行态（pending/running/succeeded/failed）';
COMMENT ON COLUMN agent_tasks.lifecycle IS '管理态（open/blocked/canceled/closed）';
COMMENT ON COLUMN agent_tasks.assigned_client_id IS '分派的客户端/Agent ID（对应 clients.id；不建外键）';
COMMENT ON COLUMN agent_tasks.idempotency_key IS '幂等键（防重复创建/派发）';
COMMENT ON COLUMN agent_tasks.input IS '结构化输入（JSONB）';
COMMENT ON COLUMN agent_tasks.output IS '结构化输出摘要（JSONB）';
COMMENT ON COLUMN agent_tasks.created_at IS '创建时间';
COMMENT ON COLUMN agent_tasks.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN agent_tasks.extra IS '扩展字段（JSONB）';


CREATE TABLE agent_task_runs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  task_id UUID NOT NULL,

  run_no INTEGER NOT NULL,
  client_id UUID NOT NULL,

  status VARCHAR(20) DEFAULT 'pending' NOT NULL,

  input_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
  output_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
  error TEXT,

  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_task_runs_status_check CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  CONSTRAINT agent_task_runs_task_run_unique UNIQUE (task_id, run_no)
);

CREATE INDEX idx_agent_task_runs_tenant_id ON agent_task_runs(tenant_id);
CREATE INDEX idx_agent_task_runs_task_id ON agent_task_runs(task_id);
CREATE INDEX idx_agent_task_runs_client_id ON agent_task_runs(client_id);
CREATE INDEX idx_agent_task_runs_tenant_status ON agent_task_runs(tenant_id, status);
CREATE INDEX idx_agent_task_runs_started_at ON agent_task_runs(started_at);
CREATE INDEX idx_agent_task_runs_created_at ON agent_task_runs(created_at);
CREATE INDEX idx_agent_task_runs_extra ON agent_task_runs USING GIN (extra);

CREATE TRIGGER update_agent_task_runs_updated_at
BEFORE UPDATE ON agent_task_runs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_task_runs IS 'Agent 任务执行表（记录每次执行尝试/重试/换客户端）';
COMMENT ON COLUMN agent_task_runs.id IS '主键';
COMMENT ON COLUMN agent_task_runs.tenant_id IS '租户 ID（冗余，便于按租户检索）';
COMMENT ON COLUMN agent_task_runs.task_id IS '任务 ID（对应 agent_tasks.id；不建外键）';
COMMENT ON COLUMN agent_task_runs.run_no IS '同一任务的第几次尝试（应用层分配）';
COMMENT ON COLUMN agent_task_runs.client_id IS '执行客户端/Agent ID（对应 clients.id；不建外键）';
COMMENT ON COLUMN agent_task_runs.status IS '执行状态（pending/running/succeeded/failed）';
COMMENT ON COLUMN agent_task_runs.input_snapshot IS '本次执行输入快照（JSONB）';
COMMENT ON COLUMN agent_task_runs.output_snapshot IS '本次执行输出快照（JSONB）';
COMMENT ON COLUMN agent_task_runs.error IS '错误信息（失败时写入）';
COMMENT ON COLUMN agent_task_runs.started_at IS '本次执行开始时间';
COMMENT ON COLUMN agent_task_runs.finished_at IS '本次执行结束时间';
COMMENT ON COLUMN agent_task_runs.created_at IS '创建时间';
COMMENT ON COLUMN agent_task_runs.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN agent_task_runs.extra IS '扩展字段（JSONB）';


CREATE TABLE agent_task_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,
  task_id UUID,
  run_id UUID,

  type VARCHAR(80) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb NOT NULL,

  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_agent_task_events_tenant_occurred_at ON agent_task_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_agent_task_events_session_occurred_at ON agent_task_events(session_id, occurred_at DESC);
CREATE INDEX idx_agent_task_events_task_occurred_at ON agent_task_events(task_id, occurred_at DESC);
CREATE INDEX idx_agent_task_events_type_occurred_at ON agent_task_events(type, occurred_at DESC);
CREATE INDEX idx_agent_task_events_payload ON agent_task_events USING GIN (payload);
CREATE INDEX idx_agent_task_events_extra ON agent_task_events USING GIN (extra);

CREATE TRIGGER update_agent_task_events_updated_at
BEFORE UPDATE ON agent_task_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_task_events IS 'Agent 任务事件表（编排/审计/回放用事件流）';
COMMENT ON COLUMN agent_task_events.id IS '主键';
COMMENT ON COLUMN agent_task_events.tenant_id IS '租户 ID';
COMMENT ON COLUMN agent_task_events.session_id IS '会话 ID（对应 agent_sessions.id；不建外键）';
COMMENT ON COLUMN agent_task_events.task_id IS '任务 ID（对应 agent_tasks.id；不建外键；可为空）';
COMMENT ON COLUMN agent_task_events.run_id IS '执行 ID（对应 agent_task_runs.id；不建外键；可为空）';
COMMENT ON COLUMN agent_task_events.type IS '事件类型（如 task.created/run.finished 等）';
COMMENT ON COLUMN agent_task_events.payload IS '事件负载（JSONB）';
COMMENT ON COLUMN agent_task_events.occurred_at IS '事件发生时间';
COMMENT ON COLUMN agent_task_events.created_at IS '创建时间';
COMMENT ON COLUMN agent_task_events.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN agent_task_events.extra IS '扩展字段（JSONB）';
