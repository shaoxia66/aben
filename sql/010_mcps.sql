-- =========================================================================
-- 010_mcps.sql
-- 包含 mcp_hub (全局共享)、mcps (租户私有/选用) 以及 client_mcps (客户端实例)
-- 架构对齐 skills，实现多租户隔离与客户端独立配置
-- MCP 启动配置统一用 config JSONB 字段存储
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
--
-- config 字段示例：
-- {
--   "command": "npx",
--   "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
-- }
-- =========================================================================
CREATE TABLE mcp_hub (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  -- 全局唯一标识，如 'puppeteer', 'sqlite'
  mcp_key VARCHAR(100) NOT NULL UNIQUE,

  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url    VARCHAR(255),

  -- MCP 启动配置 JSON，结构与 @langchain/mcp-adapters 的单条 server 配置一致
  -- 例如: {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"]}
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  author     VARCHAR(100),
  version    VARCHAR(50) DEFAULT '1.0.0' NOT NULL,
  github_url VARCHAR(255),
  site_url   VARCHAR(255),

  -- 是否已上架
  is_published BOOLEAN DEFAULT false NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra      JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_mcp_hub_mcp_key     ON mcp_hub(mcp_key);
CREATE INDEX idx_mcp_hub_is_published ON mcp_hub(is_published);
CREATE INDEX idx_mcp_hub_created_at  ON mcp_hub(created_at);
CREATE INDEX idx_mcp_hub_extra       ON mcp_hub USING GIN (extra);

CREATE TRIGGER update_mcp_hub_updated_at
  BEFORE UPDATE ON mcp_hub
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  mcp_hub            IS '全局 MCP 插件市场模板表 (Hub)';
COMMENT ON COLUMN mcp_hub.mcp_key    IS '全局唯一的 MCP 标识键';
COMMENT ON COLUMN mcp_hub.config     IS 'MCP 启动配置 JSON，结构等价于 mcp-adapters 单条 server 配置';
COMMENT ON COLUMN mcp_hub.is_published IS '是否已在客户端市场上架展示';


-- =========================================================================
-- 2. mcps: 租户维度的 MCP 配置表
--    租户可以从 Hub 选配，也可以完全自定义
--
-- config 字段与 mcp_hub 相同格式，支持租户覆盖 Hub 的默认值
-- =========================================================================
CREATE TABLE mcps (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  -- 在该租户下唯一，可通过 mcp_key 关联到 mcp_hub
  mcp_key VARCHAR(100) NOT NULL,

  name        VARCHAR(100) NOT NULL,
  description TEXT,

  -- MCP 启动配置 JSON（可覆盖 Hub 默认值）
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra      JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT mcps_tenant_mcp_key_unique UNIQUE (tenant_id, mcp_key)
);

CREATE INDEX idx_mcps_tenant_id      ON mcps(tenant_id);
CREATE INDEX idx_mcps_tenant_mcp_key ON mcps(tenant_id, mcp_key);
CREATE INDEX idx_mcps_config         ON mcps USING GIN (config);
CREATE INDEX idx_mcps_extra          ON mcps USING GIN (extra);

CREATE TRIGGER update_mcps_updated_at
  BEFORE UPDATE ON mcps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  mcps            IS '租户维度的 MCP 配置表';
COMMENT ON COLUMN mcps.tenant_id  IS '租户 ID';
COMMENT ON COLUMN mcps.mcp_key    IS '租户内唯一的 MCP 标识（从 Hub 导入时保持与 Hub 一致）';
COMMENT ON COLUMN mcps.config     IS 'MCP 启动配置 JSON，覆盖 Hub 提供的默认配置';


-- =========================================================================
-- 3. client_mcps: 客户端实例层
--    承载端侧隐私配置，如真实 API_KEY 等环境变量，结构合并进 config
--
-- config 字段示例（含运行时私密 env）：
-- {
--   "command": "npx",
--   "args": ["-y", "@modelcontextprotocol/server-sqlite"],
--   "env": {
--     "DB_PATH": "/Users/wangjuwei/data/local.db"
--   }
-- }
-- =========================================================================
CREATE TABLE client_mcps (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,

  -- 对应 mcps 或 mcp_hub 的标识
  mcp_key VARCHAR(100) NOT NULL,

  -- 端侧完整 MCP 启动配置（含私密 env），由桌面客户端写入
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_enabled BOOLEAN DEFAULT true NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra      JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT client_mcps_unique UNIQUE (tenant_id, client_id, mcp_key)
);

CREATE INDEX idx_client_mcps_tenant_client ON client_mcps(tenant_id, client_id);
CREATE INDEX idx_client_mcps_tenant_mcp    ON client_mcps(tenant_id, mcp_key);
CREATE INDEX idx_client_mcps_config        ON client_mcps USING GIN (config);
CREATE INDEX idx_client_mcps_extra         ON client_mcps USING GIN (extra);

CREATE TRIGGER update_client_mcps_updated_at
  BEFORE UPDATE ON client_mcps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  client_mcps             IS '客户端本地配置的 MCP 启动实例表';
COMMENT ON COLUMN client_mcps.tenant_id   IS '租户 ID';
COMMENT ON COLUMN client_mcps.client_id   IS '设备/客户端 ID';
COMMENT ON COLUMN client_mcps.mcp_key     IS '对应 mcps 或 mcp_hub 的标识';
COMMENT ON COLUMN client_mcps.config      IS '端侧完整 MCP 启动配置，含私密 env（API Key 等）';
COMMENT ON COLUMN client_mcps.is_enabled  IS '是否在该客户端上启用';
