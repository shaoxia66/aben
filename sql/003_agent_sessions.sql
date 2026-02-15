CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  client_ids UUID[] DEFAULT '{}'::uuid[] NOT NULL,

  title VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_sessions_status_check CHECK (status IN ('active', 'closed', 'archived'))
);

CREATE INDEX idx_agent_sessions_tenant_id ON agent_sessions(tenant_id);
CREATE INDEX idx_agent_sessions_tenant_status ON agent_sessions(tenant_id, status);
CREATE INDEX idx_agent_sessions_tenant_last_message_at ON agent_sessions(tenant_id, last_message_at DESC);
CREATE INDEX idx_agent_sessions_client_ids ON agent_sessions USING GIN (client_ids);
CREATE INDEX idx_agent_sessions_created_at ON agent_sessions(created_at);
CREATE INDEX idx_agent_sessions_extra ON agent_sessions USING GIN (extra);

CREATE TRIGGER update_agent_sessions_updated_at
BEFORE UPDATE ON agent_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_sessions IS 'Agent 会话表（租户内与 agent 的对话上下文）';
COMMENT ON COLUMN agent_sessions.id IS '主键';
COMMENT ON COLUMN agent_sessions.tenant_id IS '租户 ID';
COMMENT ON COLUMN agent_sessions.client_ids IS '参与会话的客户端/Agent IDs（UUID 数组；对应 clients.id；不建外键）';
COMMENT ON COLUMN agent_sessions.title IS '会话标题（可为空）';
COMMENT ON COLUMN agent_sessions.status IS '会话状态（active/closed/archived）';
COMMENT ON COLUMN agent_sessions.last_message_at IS '最近一条消息时间（用于列表排序）';
COMMENT ON COLUMN agent_sessions.created_at IS '创建时间';
COMMENT ON COLUMN agent_sessions.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN agent_sessions.extra IS '扩展字段（JSONB）';

CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL,

  seq INTEGER NOT NULL,
  author_type VARCHAR(20) NOT NULL,
  author_id UUID,

  content TEXT,
  content_json JSONB DEFAULT '{}'::jsonb NOT NULL,

  reply_to_message_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT agent_messages_author_type_check CHECK (author_type IN ('agent', 'system', 'tool')),
  CONSTRAINT agent_messages_seq_unique UNIQUE (session_id, seq)
);

CREATE INDEX idx_agent_messages_tenant_id ON agent_messages(tenant_id);
CREATE INDEX idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX idx_agent_messages_session_seq ON agent_messages(session_id, seq);
CREATE INDEX idx_agent_messages_session_created_at ON agent_messages(session_id, created_at ASC);
CREATE INDEX idx_agent_messages_tenant_created_at ON agent_messages(tenant_id, created_at DESC);
CREATE INDEX idx_agent_messages_reply_to_message_id ON agent_messages(reply_to_message_id);
CREATE INDEX idx_agent_messages_content_json ON agent_messages USING GIN (content_json);
CREATE INDEX idx_agent_messages_extra ON agent_messages USING GIN (extra);

CREATE TRIGGER update_agent_messages_updated_at
BEFORE UPDATE ON agent_messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE agent_messages IS 'Agent 会话消息表（与 agent 交互的消息内容）';
COMMENT ON COLUMN agent_messages.id IS '主键';
COMMENT ON COLUMN agent_messages.tenant_id IS '租户 ID（冗余，便于按租户检索）';
COMMENT ON COLUMN agent_messages.session_id IS '会话 ID（对应 agent_sessions.id；不建外键）';
COMMENT ON COLUMN agent_messages.seq IS '会话内序号（用于稳定排序；由应用层分配）';
COMMENT ON COLUMN agent_messages.author_type IS '作者类型（agent/system/tool）';
COMMENT ON COLUMN agent_messages.author_id IS '作者 ID（一般为 client_id；system/tool 可为空）';
COMMENT ON COLUMN agent_messages.content IS '纯文本内容（可为空，结构化内容见 content_json）';
COMMENT ON COLUMN agent_messages.content_json IS '结构化内容（JSONB：tool call、附件引用等）';
COMMENT ON COLUMN agent_messages.reply_to_message_id IS '回复的消息 ID（可为空）';
COMMENT ON COLUMN agent_messages.created_at IS '创建时间';
COMMENT ON COLUMN agent_messages.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN agent_messages.extra IS '扩展字段（JSONB）';
