---
name: cypher-mcp-first
description: 编写 Cypher 前强制检查数据库。当需要编写 Neo4j Cypher 查询或任何图数据库操作时使用此技能。要求在编写任何 Cypher 代码之前，必须使用 MCP 数据库工具检查节点标签、关系类型、属性定义和样本数据。防止因对图结构的错误假设而导致 Cypher 错误。适用于 Neo4j 图数据库。
---

# Cypher 先查后写

**核心原则：先查后写，杜绝假设**

在编写任何 Cypher 语句之前，必须通过 MCP 工具完成数据库探查。

## 强制工作流

### 第一步：探查图数据库结构

在写 Cypher 之前，必须执行以下查询：

1. **查看所有节点标签**
   ```cypher
   // 获取数据库中所有节点标签
   CALL db.labels()
   ```

2. **查看所有关系类型**
   ```cypher
   // 获取数据库中所有关系类型
   CALL db.relationshipTypes()
   ```

3. **查看节点属性**
   ```cypher
   // 查看指定标签节点的所有属性键
   MATCH (n:标签名) 
   RETURN keys(n) AS 属性列表 
   LIMIT 1
   ```

4. **查看关系属性**
   ```cypher
   // 查看指定关系类型的所有属性键
   MATCH ()-[r:关系类型]->() 
   RETURN keys(r) AS 属性列表 
   LIMIT 1
   ```

5. **查看样本数据**
   ```cypher
   // 获取少量节点数据了解实际内容
   MATCH (n:标签名) 
   RETURN n 
   LIMIT 5
   ```

6. **查看图结构概览**
   ```cypher
   // 查看节点和关系的连接模式
   CALL db.schema.visualization()
   ```

7. **查看完整元数据**（可选）
   ```cypher
   // 获取数据库完整元数据结构
   CALL apoc.meta.schema()
   ```

### 第二步：确认后再写 Cypher

只有在完成上述探查后，才能编写正式的 Cypher 语句。

## 禁止事项

- 禁止凭记忆或假设编写 Cypher
- 禁止不查看标签和关系类型就写 MATCH 模式
- 禁止不确认属性名就写 WHERE 条件
- 禁止不看样本数据就写复杂查询
- 禁止假设节点之间的关系方向

## 示例流程

用户请求："帮我写一个查询用户和订单关系的 Cypher"

正确做法：
1. 先用 MCP 工具执行 `CALL db.labels()` 找到相关节点标签
2. 执行 `CALL db.relationshipTypes()` 查看关系类型
3. 执行 `MATCH (n:User) RETURN keys(n) LIMIT 1` 查看用户节点属性
4. 执行 `MATCH (n:User) RETURN n LIMIT 5` 查看样本数据
5. 基于实际结构编写 Cypher