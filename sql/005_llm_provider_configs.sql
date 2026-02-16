CREATE TABLE llm_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  provider VARCHAR(40) NOT NULL,

  model_name VARCHAR(255),
  base_url TEXT,
  api_key TEXT,
  api_key_last4 VARCHAR(4),
  status VARCHAR(20) DEFAULT 'enabled' NOT NULL,

  created_by UUID,
  updated_by UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT llm_provider_configs_status_check CHECK (status IN ('enabled', 'disabled'))
);

CREATE UNIQUE INDEX idx_llm_provider_configs_tenant_provider ON llm_provider_configs(tenant_id, provider);
CREATE INDEX idx_llm_provider_configs_tenant_status ON llm_provider_configs(tenant_id, status);
CREATE INDEX idx_llm_provider_configs_tenant_created_at ON llm_provider_configs(tenant_id, created_at DESC);
CREATE INDEX idx_llm_provider_configs_extra ON llm_provider_configs USING GIN (extra);

CREATE TRIGGER update_llm_provider_configs_updated_at
BEFORE UPDATE ON llm_provider_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE llm_provider_configs IS '租户大模型厂商配置表（厂商、API Key、Base URL、默认模型等）';
COMMENT ON COLUMN llm_provider_configs.id IS '主键';
COMMENT ON COLUMN llm_provider_configs.tenant_id IS '租户 ID';
COMMENT ON COLUMN llm_provider_configs.provider IS '厂商标识（如 openai/anthropic/deepseek/qwen/azure_openai/custom）';
COMMENT ON COLUMN llm_provider_configs.model_name IS '模型名称（可为空）';
COMMENT ON COLUMN llm_provider_configs.base_url IS 'Base URL（可为空，使用 SDK 默认值）';
COMMENT ON COLUMN llm_provider_configs.api_key IS 'API Key（明文；由管理员配置）';
COMMENT ON COLUMN llm_provider_configs.api_key_last4 IS 'API Key 后 4 位（用于展示与确认）';
COMMENT ON COLUMN llm_provider_configs.status IS '状态（enabled/disabled）';
COMMENT ON COLUMN llm_provider_configs.created_by IS '创建人用户 ID';
COMMENT ON COLUMN llm_provider_configs.updated_by IS '更新人用户 ID';
COMMENT ON COLUMN llm_provider_configs.created_at IS '创建时间';
COMMENT ON COLUMN llm_provider_configs.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN llm_provider_configs.extra IS '扩展字段（JSONB）';
