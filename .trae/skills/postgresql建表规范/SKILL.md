---
name: postgresql建表规范
description: 规范 PostgreSQL 建表 SQL（UUIDv7 主键、必需字段、索引/触发器/备注、默认不使用外键）。当你要新建/审查表结构或生成迁移脚本时调用。
---

# PostgreSQL 建表规范（UUIDv7 + 默认无外键）

## 使用场景

- 创建新的数据库表
- 审查现有表结构
- 生成数据库迁移脚本

## 规范要求

### 1) 主键与 ID 类型（强制）

- 所有表主键必须使用 UUIDv7：
  - 仅支持 PostgreSQL 18+：`id UUID PRIMARY KEY DEFAULT uuidv7()`
- 所有跨表引用字段一律使用 `UUID` 类型（例如 `tenant_id UUID NOT NULL`、`user_id UUID NOT NULL`）

### 2) 外键策略（默认不使用外键）

- 默认不创建 `REFERENCES ...` 外键约束（包括 `ON DELETE` / `ON UPDATE`）
- 只保留 `*_id UUID` 字段 + 必要索引
- 数据完整性由应用层、后台任务（清理孤儿数据）或业务流程保证

### 3) 必需字段（强制）

每张表必须包含以下三个字段：

| 字段名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| created_at | TIMESTAMP WITH TIME ZONE | CURRENT_TIMESTAMP | 记录创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | CURRENT_TIMESTAMP | 记录更新时间，需要 `updated_at` 自动更新触发器 |
| extra | JSONB | `'{}'::jsonb` | 扩展字段，存储额外信息 |

### 4) 任务状态字段（按需）

如果表中需要表示任务状态，请使用 `status` 字段：

```sql
status VARCHAR(20) DEFAULT 'pending' NOT NULL
```

允许的状态值：

- pending - 待处理
- running - 运行中
- succeeded - 成功
- failed - 失败

建议添加 CHECK 约束：

```sql
CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'succeeded', 'failed'))
```

### 5) 积分字段（按需）

积分相关数据使用 `credits` 字段：

```sql
credits INTEGER DEFAULT 0 NOT NULL
```

或使用 DECIMAL 类型支持小数：

```sql
credits DECIMAL(12, 2) DEFAULT 0.00 NOT NULL
```

## 输出要求

生成建表语句时，必须同时输出以下内容：

### 0) UUIDv7 依赖（强制）

```sql
-- PostgreSQL 18+ 内置 uuidv7()，无需自定义函数或扩展
SELECT uuidv7();
```

### 1) CREATE TABLE 语句（强制）

```sql
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  -- 业务字段示例（默认无外键，仅保留 UUID 引用字段）
  tenant_id UUID NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb
);
```

### 2) 索引语句（按需）

```sql
CREATE INDEX idx_table_name_created_at ON table_name(created_at);

CREATE INDEX idx_table_name_status ON table_name(status);

CREATE INDEX idx_table_name_extra ON table_name USING GIN (extra);

CREATE INDEX idx_table_name_tenant_id ON table_name(tenant_id);
```

### 3) updated_at 自动更新触发器（强制）

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_table_name_updated_at
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 4) 表与字段备注（强制）

```sql
COMMENT ON TABLE table_name IS '表用途描述';
COMMENT ON COLUMN table_name.some_field IS '字段用途描述';
```

## 完整示例

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  credits INTEGER DEFAULT 0 NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  extra JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'succeeded', 'failed'))
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_extra ON tasks USING GIN (extra);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tasks IS '任务表';
COMMENT ON COLUMN tasks.status IS '任务状态: pending/running/succeeded/failed';
COMMENT ON COLUMN tasks.credits IS '积分';
COMMENT ON COLUMN tasks.extra IS '扩展字段';
```

## 命名规范

- 表名：使用小写字母和下划线，复数形式（如 `users`, `order_items`）
- 字段名：使用小写字母和下划线（如 `created_at`, `user_id`）
- 索引名：`idx_表名_字段名`（如 `idx_users_email`）
- 触发器名：`update_表名_updated_at`
- 约束名：描述性名称（如 `valid_status`, `uq_users_email`）
