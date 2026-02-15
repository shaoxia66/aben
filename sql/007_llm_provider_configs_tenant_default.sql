DROP INDEX IF EXISTS idx_llm_provider_configs_tenant_provider_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_provider_configs_tenant_default
ON llm_provider_configs(tenant_id)
WHERE is_default;

COMMENT ON INDEX idx_llm_provider_configs_tenant_default IS '同一租户最多一条默认大模型配置';

