CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  client_type VARCHAR(50) NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  auth_key TEXT NOT NULL,
  auth_key_last_used_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'enabled' NOT NULL,
  version VARCHAR(50),
  platform VARCHAR(50),
  last_seen_at TIMESTAMP WITH TIME ZONE,
  run_status TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  capabilities JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT clients_status_check CHECK (status IN ('enabled', 'disabled', 'archived'))
);

CREATE UNIQUE INDEX idx_clients_tenant_code ON clients(tenant_id, code);
CREATE UNIQUE INDEX idx_clients_tenant_auth_key ON clients(tenant_id, auth_key);
CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX idx_clients_tenant_type ON clients(tenant_id, client_type);
CREATE INDEX idx_clients_tenant_status ON clients(tenant_id, status);
CREATE INDEX idx_clients_tenant_last_seen_at ON clients(tenant_id, last_seen_at);
CREATE INDEX idx_clients_config ON clients USING GIN (config);
CREATE INDEX idx_clients_capabilities ON clients USING GIN (capabilities);
CREATE INDEX idx_clients_extra ON clients USING GIN (extra);

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE clients IS '租户客户端表（如 windows_agent、voice_control 等接入端）';
COMMENT ON COLUMN clients.id IS '主键';
COMMENT ON COLUMN clients.tenant_id IS '租户 ID';
COMMENT ON COLUMN clients.client_type IS '客户端类型（如 windows_agent、voice_control）';
COMMENT ON COLUMN clients.code IS '租户内稳定标识（用于引用/绑定/路由）';
COMMENT ON COLUMN clients.name IS '展示名称';
COMMENT ON COLUMN clients.description IS '描述';
COMMENT ON COLUMN clients.auth_key IS '客户端认证 Key（明文；由服务端生成后下发给客户端）';
COMMENT ON COLUMN clients.auth_key_last_used_at IS '认证 Key 最近使用时间';
COMMENT ON COLUMN clients.status IS '状态（enabled/disabled/archived）';
COMMENT ON COLUMN clients.version IS '客户端版本号';
COMMENT ON COLUMN clients.platform IS '运行平台（如 windows/mac/linux/ios/android/web 等）';
COMMENT ON COLUMN clients.last_seen_at IS '最近心跳时间（用于判断在线）';
COMMENT ON COLUMN clients.run_status IS '客户端运行状态文本（由客户端上报；用于展示）';
COMMENT ON COLUMN clients.config IS '客户端配置（JSONB；避免存储密钥，可存凭证引用）';
COMMENT ON COLUMN clients.capabilities IS '客户端能力声明（JSONB；功能开关/支持的命令等）';
COMMENT ON COLUMN clients.created_by IS '创建人用户 ID';
COMMENT ON COLUMN clients.updated_by IS '更新人用户 ID';
COMMENT ON COLUMN clients.created_at IS '创建时间';
COMMENT ON COLUMN clients.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN clients.extra IS '扩展字段（JSONB）';
