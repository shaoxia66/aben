CREATE TABLE client_skills (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  skill_key VARCHAR(100) NOT NULL,

  order_no INTEGER DEFAULT 0 NOT NULL,

  enabled BOOLEAN DEFAULT TRUE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT client_skills_unique UNIQUE (tenant_id, client_id, skill_key)
);

CREATE INDEX idx_client_skills_tenant_client
  ON client_skills(tenant_id, client_id);

CREATE INDEX idx_client_skills_tenant_skill
  ON client_skills(tenant_id, skill_key);

CREATE INDEX idx_client_skills_extra
  ON client_skills USING GIN (extra);

CREATE TRIGGER update_client_skills_updated_at
BEFORE UPDATE ON client_skills
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_skills IS '客户端可用 skills 关联表（每行一个 client + skill_key）';
COMMENT ON COLUMN client_skills.id IS '主键';
COMMENT ON COLUMN client_skills.tenant_id IS '租户 ID（与 clients.tenant_id 对齐；不建外键）';
COMMENT ON COLUMN client_skills.client_id IS '客户端 ID（对应 clients.id；不建外键）';
COMMENT ON COLUMN client_skills.skill_key IS 'Skill 标识（对应 skills.skill_key）';
COMMENT ON COLUMN client_skills.order_no IS '在客户端上的展示/执行顺序（越小越靠前）';
COMMENT ON COLUMN client_skills.enabled IS '是否启用该 skill（true 启用，false 禁用）';
COMMENT ON COLUMN client_skills.created_at IS '创建时间';
COMMENT ON COLUMN client_skills.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN client_skills.extra IS '扩展字段（JSONB，比如 per-client 的 skill 配置）';
