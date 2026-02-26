import { withTransaction } from "@/server/shared/db/pg";
import type { Container } from "@/server/container";
import type { HubSkillSummary } from "@/server/skills/application/queries/list-hub-skills";

export class InstallHubSkillError extends Error {
  code: "NOT_FOUND";

  constructor(code: InstallHubSkillError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "InstallHubSkillError";
  }
}

export async function installHubSkill(
  container: Container,
  params: { tenantId: string; userId: string; skillKey: string }
): Promise<HubSkillSummary> {
  const summary = await withTransaction(async (client) => {
    const hubRows = await client.query<{
      skill_key: string;
      path: string;
      name: string | null;
      description: string | null;
      content: string;
      content_type: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      [
        "SELECT skill_key, path, name, description, content, content_type, created_at, updated_at",
        "FROM skills_hub",
        "WHERE skill_key = $1",
        "ORDER BY (path = '') DESC, path ASC"
      ].join(" "),
      [params.skillKey]
    );

    if (hubRows.rows.length === 0) {
      throw new InstallHubSkillError("NOT_FOUND", "未在仓库中找到对应的 skill");
    }

    await client.query("DELETE FROM skills WHERE tenant_id = $1 AND skill_key = $2", [
      params.tenantId,
      params.skillKey
    ]);

    const values: unknown[] = [];
    const placeholders: string[] = [];

    hubRows.rows.forEach((row, index) => {
      const baseIndex = index * 7;
      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`
      );
      values.push(
        params.tenantId,
        row.skill_key,
        row.path,
        row.name,
        row.description,
        row.content,
        row.content_type ?? "text/markdown"
      );
    });

    await client.query(
      [
        "INSERT INTO skills (tenant_id, skill_key, path, name, description, content, content_type)",
        `VALUES ${placeholders.join(", ")}`
      ].join(" "),
      values
    );

    const root =
      hubRows.rows.find((row) => row.path === "") ??
      hubRows.rows[0]!;

    return {
      skillKey: params.skillKey,
      name: root.name ?? params.skillKey,
      description: root.description,
      fileCount: hubRows.rows.length,
      createdAt: root.created_at.toISOString(),
      updatedAt: root.updated_at.toISOString()
    } satisfies HubSkillSummary;
  });

  await container.eventBus.publish({
    type: "skills.hub.installed",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      skillKey: params.skillKey,
      installedBy: params.userId
    }
  });

  return summary;
}

