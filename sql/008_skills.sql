CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  skill_key VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,

  name VARCHAR(200),
  description TEXT,
  content TEXT NOT NULL,
  content_type VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_skills_tenant_skill_key_path
  ON skills(tenant_id, skill_key, path);
CREATE INDEX idx_skills_tenant_skill_key
  ON skills(tenant_id, skill_key);

CREATE TRIGGER update_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE skills IS '租户内技能内容表（每行对应一个 md 文件）';
COMMENT ON COLUMN skills.id IS '主键';
COMMENT ON COLUMN skills.tenant_id IS '租户 ID';
COMMENT ON COLUMN skills.skill_key IS '技能标识，对应技能根目录名（在同一租户内唯一）';
COMMENT ON COLUMN skills.path IS '相对路径：顶层 SKILL.md 为空字符串，其它为相对路径';
COMMENT ON COLUMN skills.name IS '技能名称（顶层记录使用）';
COMMENT ON COLUMN skills.description IS '技能描述（顶层记录使用）';
COMMENT ON COLUMN skills.content IS 'md 文件内容';
COMMENT ON COLUMN skills.content_type IS '内容类型，如 text/markdown';
COMMENT ON COLUMN skills.created_at IS '创建时间';
COMMENT ON COLUMN skills.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN skills.extra IS '扩展字段（JSONB）';

CREATE TABLE skills_hub (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  skill_key VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,

  name VARCHAR(200),
  description TEXT,
  content TEXT NOT NULL,
  content_type VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_skills_hub_skill_key_path
  ON skills_hub(skill_key, path);
CREATE INDEX idx_skills_hub_skill_key
  ON skills_hub(skill_key);

CREATE TRIGGER update_skills_hub_updated_at
BEFORE UPDATE ON skills_hub
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE skills_hub IS '公开技能内容表（每行对应一个 md 文件，全局共享）';
COMMENT ON COLUMN skills_hub.id IS '主键';
COMMENT ON COLUMN skills_hub.skill_key IS '技能标识，对应技能根目录名（全局唯一）';
COMMENT ON COLUMN skills_hub.path IS '相对路径：顶层 SKILL.md 为空字符串，其它为相对路径';
COMMENT ON COLUMN skills_hub.name IS '技能名称（顶层记录使用）';
COMMENT ON COLUMN skills_hub.description IS '技能描述（顶层记录使用）';
COMMENT ON COLUMN skills_hub.content IS 'md 文件内容';
COMMENT ON COLUMN skills_hub.content_type IS '内容类型，如 text/markdown';
COMMENT ON COLUMN skills_hub.created_at IS '创建时间';
COMMENT ON COLUMN skills_hub.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN skills_hub.extra IS '扩展字段（JSONB）';
