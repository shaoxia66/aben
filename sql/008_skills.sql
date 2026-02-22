CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  skill_key VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,

  name VARCHAR(200),
  description TEXT,
  content TEXT NOT NULL,
  content_type VARCHAR(100),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_skills_skill_key_path ON skills(skill_key, path);
CREATE INDEX idx_skills_skill_key ON skills(skill_key);

CREATE TRIGGER update_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE skills IS '技能内容表（每行对应一个 md 文件）';
COMMENT ON COLUMN skills.id IS '主键';
COMMENT ON COLUMN skills.skill_key IS '技能标识，对应技能根目录名';
COMMENT ON COLUMN skills.path IS '相对路径：顶层 SKILL.md 为空字符串，其它为相对路径';
COMMENT ON COLUMN skills.name IS '技能名称（顶层记录使用）';
COMMENT ON COLUMN skills.description IS '技能描述（顶层记录使用）';
COMMENT ON COLUMN skills.content IS 'md 文件内容';
COMMENT ON COLUMN skills.content_type IS '内容类型，如 text/markdown';
COMMENT ON COLUMN skills.enabled IS '是否可用：true 表示启用，false 表示禁用';
COMMENT ON COLUMN skills.created_at IS '创建时间';
COMMENT ON COLUMN skills.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN skills.extra IS '扩展字段（JSONB）';
