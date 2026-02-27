---
name: sql-mcp-first
description: 编写 SQL 前强制检查数据库。当需要编写 SQL 查询、语句或任何数据库操作时使用此技能。要求在编写任何 SQL 代码之前，必须使用 MCP 数据库工具检查表结构、字段定义和样本数据。防止因对表结构的错误假设而导致 SQL 错误。适用于 PostgreSQL 数据库。
---

# SQL 先查后写

**核心原则：先查后写，杜绝假设**

在编写任何 SQL 语句之前，必须通过 MCP 工具完成数据库探查。

## 强制工作流

### 第一步：探查数据库结构

在写 SQL 之前，必须执行以下查询：

1. **查看表结构**
   ```sql
   -- 查看目标表的所有字段、类型、约束
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = '表名';
   ```

2. **查看样本数据**
   ```sql
   -- 获取少量数据了解实际内容和格式
   SELECT * FROM 表名 LIMIT 5;
   ```

3. **查看所有表**（不确定表名时）
   ```sql
   -- 列出当前数据库的所有表
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

4. **查看相关表**（涉及 JOIN 时）
   ```sql
   -- 模糊搜索相关表名
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE '%关键词%';
   ```

### 第二步：确认后再写 SQL

只有在完成上述探查后，才能编写正式的 SQL 语句。

## 禁止事项

- 禁止凭记忆或假设编写 SQL
- 禁止不查看字段就写 WHERE 条件
- 禁止不确认字段类型就做类型转换
- 禁止不看样本数据就写复杂查询

## 示例流程

用户请求："帮我写一个查询用户订单的 SQL"

正确做法：
1. 先用 MCP 工具执行查询找到相关表
2. 执行 `information_schema.columns` 查询查看表结构
3. 执行 `SELECT * FROM 表名 LIMIT 5` 查看数据格式
4. 基于实际字段编写 SQL