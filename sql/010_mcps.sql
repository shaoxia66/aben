-- =========================================================================
-- 010_mcps.sql
-- 包含 mcp_hub (全局共享)、mcps (租户私有/选用) 以及 client_mcps (客户端实例)
-- 架构对齐 skills，实现多租户隔离与客户端独立配置
-- =========================================================================

-- PostgreSQL 18+ 内置 uuidv7()，无需自定义函数或扩展
-- SELECT uuidv7();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =========================================================================
-- 1. mcp_hub: 云端插件市场模板表 (全局共享)
-- =========================================================================
CREATE TABLE mcp_hub (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  
  -- 唯一标识，如 'puppeteer', 'sqlite'
  mcp_key VARCHAR(100) NOT NULL UNIQUE,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url VARCHAR(255),
  
  -- 启动所需命令，例如: 'npx'
  command VARCHAR(100) NOT NULL, 
  -- 默认启动参数数组模板，例如: '["-y", "@modelcontextprotocol/server-puppeteer"]'
  args JSONB DEFAULT '[]'::jsonb NOT NULL,
  
  -- 需要用户填写的环境变量表单结构定义 (Schema)
  env_schema JSONB DEFAULT '[]'::jsonb, 
  
  author VARCHAR(100),
  version VARCHAR(50) DEFAULT '1.0.0' NOT NULL,
  github_url VARCHAR(255),
  site_url VARCHAR(255),
  
  -- 是否已上架
  is_published BOOLEAN DEFAULT false NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_mcp_hub_mcp_key ON mcp_hub(mcp_key);
CREATE INDEX idx_mcp_hub_is_published ON mcp_hub(is_published);
CREATE INDEX idx_mcp_hub_created_at ON mcp_hub(created_at);
CREATE INDEX idx_mcp_hub_extra ON mcp_hub USING GIN (extra);

CREATE TRIGGER update_mcp_hub_updated_at
  BEFORE UPDATE ON mcp_hub
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE mcp_hub IS '全局 MCP 插件市场模板表 (Hub)';
COMMENT ON COLUMN mcp_hub.mcp_key IS '全局唯一的 MCP 标识键';
COMMENT ON COLUMN mcp_hub.name IS '展示名称';
COMMENT ON COLUMN mcp_hub.command IS '启动命令要求，如 npx 或 docker';
COMMENT ON COLUMN mcp_hub.args IS '启动参数数组模板';
COMMENT ON COLUMN mcp_hub.env_schema IS '需要的环境变量表单结构定义，发给客户端渲染表单';
COMMENT ON COLUMN mcp_hub.is_published IS '是否已在客户端市场展示(上架)';

-- =========================================================================
-- 2. mcps: 租户维度的 MCP 配置 (租户自己添加的或从 Hub 选配的)
-- =========================================================================
CREATE TABLE mcps (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  
  tenant_id UUID NOT NULL,
  -- 在该租户下唯一的标识，也可以通过这个 key 关联到 mcp_hub
  mcp_key VARCHAR(100) NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- 可以覆写或继承 Hub 的命令
  command VARCHAR(100) NOT NULL,
  args JSONB DEFAULT '[]'::jsonb NOT NULL,
  env_schema JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT mcps_tenant_mcp_key_unique UNIQUE (tenant_id, mcp_key)
);

CREATE INDEX idx_mcps_tenant_id ON mcps(tenant_id);
CREATE INDEX idx_mcps_tenant_mcp_key ON mcps(tenant_id, mcp_key);
CREATE INDEX idx_mcps_extra ON mcps USING GIN (extra);

CREATE TRIGGER update_mcps_updated_at
  BEFORE UPDATE ON mcps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE mcps IS '租户维度的 MCP 列表';
COMMENT ON COLUMN mcps.tenant_id IS '租户 ID';
COMMENT ON COLUMN mcps.mcp_key IS '租户内唯一的 MCP 标识（如果从 Hub 引入，则保持一致）';
COMMENT ON COLUMN mcps.name IS '名称';
COMMENT ON COLUMN mcps.command IS '启动命令要求';
COMMENT ON COLUMN mcps.args IS '启动参数数组';

-- =========================================================================
-- 3. client_mcps: 客户端或用户配置的最终实例
-- (主要存特定设备的 API KEY 等私密和设备强绑定信息)
-- =========================================================================
CREATE TABLE client_mcps (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL, 
  
  -- 呼应 mcps 表的 key
  mcp_key VARCHAR(100) NOT NULL,
  
  -- 用户填入的真实环境变量配置，例如 API_KEY 等 (JSON K-V 结构)
  env JSONB DEFAULT '{}'::jsonb NOT NULL,
  
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT client_mcps_unique UNIQUE (tenant_id, client_id, mcp_key)
);

CREATE INDEX idx_client_mcps_tenant_client ON client_mcps(tenant_id, client_id);
CREATE INDEX idx_client_mcps_tenant_mcp ON client_mcps(tenant_id, mcp_key);
CREATE INDEX idx_client_mcps_extra ON client_mcps USING GIN (extra);

CREATE TRIGGER update_client_mcps_updated_at
  BEFORE UPDATE ON client_mcps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_mcps IS '客户端本地配置的 MCP 启动实例和环境变量表';
COMMENT ON COLUMN client_mcps.tenant_id IS '租户 ID';
COMMENT ON COLUMN client_mcps.client_id IS '关联的具体客户端设备 ID';
COMMENT ON COLUMN client_mcps.mcp_key IS '呼应 mcps 或 mcp_hub 的模板标识';
COMMENT ON COLUMN client_mcps.env IS '安全环境变量配置，例如用户的 API Keys';
COMMENT ON COLUMN client_mcps.is_enabled IS '是否在客户端启用该实例';
