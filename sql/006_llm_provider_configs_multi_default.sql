ALTER TABLE llm_provider_configs
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE NOT NULL;

DROP INDEX IF EXISTS idx_llm_provider_configs_tenant_provider;

CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_tenant_provider
ON llm_provider_configs(tenant_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_provider_configs_tenant_provider_default
ON llm_provider_configs(tenant_id, provider)
WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_tenant_provider_is_default
ON llm_provider_configs(tenant_id, provider, is_default);

COMMENT ON COLUMN llm_provider_configs.is_default IS '是否默认配置（同一租户同一厂商最多一个默认）';

