CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenants IS '租户表（多租户工作空间/组织）';
COMMENT ON COLUMN tenants.id IS '主键';
COMMENT ON COLUMN tenants.slug IS '租户短标识（用于 URL/人类可读唯一标识）';
COMMENT ON COLUMN tenants.name IS '租户名称';
COMMENT ON COLUMN tenants.is_active IS '是否启用';
COMMENT ON COLUMN tenants.created_at IS '创建时间';
COMMENT ON COLUMN tenants.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN tenants.extra IS '扩展字段（JSONB）';

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  email VARCHAR(320),
  email_verified_at TIMESTAMP WITH TIME ZONE,
  password_hash TEXT,
  display_name VARCHAR(255),
  avatar_url TEXT,
  is_disabled BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_users_email_lower_unique
ON users ((lower(email)))
WHERE email IS NOT NULL;

CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS '全局用户表（一个用户可加入多个租户）';
COMMENT ON COLUMN users.id IS '主键';
COMMENT ON COLUMN users.email IS '登录邮箱（全局唯一，忽略大小写；可为空以支持无邮箱账号）';
COMMENT ON COLUMN users.email_verified_at IS '邮箱验证通过时间';
COMMENT ON COLUMN users.password_hash IS '本地账号密码哈希（仅存哈希，不存明文）';
COMMENT ON COLUMN users.display_name IS '显示名称';
COMMENT ON COLUMN users.avatar_url IS '头像 URL';
COMMENT ON COLUMN users.is_disabled IS '是否禁用（禁用后不可登录）';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN users.extra IS '扩展字段（JSONB）';

CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(40) DEFAULT 'member' NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  invited_by_user_id UUID,
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT tenant_users_unique UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_users_status_check CHECK (status IN ('invited', 'active', 'suspended', 'removed'))
);

CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_created_at ON tenant_users(created_at);

CREATE TRIGGER update_tenant_users_updated_at
BEFORE UPDATE ON tenant_users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tenant_users IS '租户成员表（用户在租户内的角色与状态）';
COMMENT ON COLUMN tenant_users.id IS '主键';
COMMENT ON COLUMN tenant_users.tenant_id IS '租户 ID';
COMMENT ON COLUMN tenant_users.user_id IS '用户 ID';
COMMENT ON COLUMN tenant_users.role IS '租户内角色（如 owner/admin/member 等，按业务扩展）';
COMMENT ON COLUMN tenant_users.status IS '成员状态（invited/active/suspended/removed）';
COMMENT ON COLUMN tenant_users.invited_by_user_id IS '邀请人用户 ID';
COMMENT ON COLUMN tenant_users.joined_at IS '加入时间（从 invited 转为 active 时写入）';
COMMENT ON COLUMN tenant_users.created_at IS '创建时间';
COMMENT ON COLUMN tenant_users.updated_at IS '更新时间（由触发器自动维护）';
COMMENT ON COLUMN tenant_users.extra IS '扩展字段（JSONB）';
