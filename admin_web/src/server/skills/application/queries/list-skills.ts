import { withTransaction } from "@/server/shared/db/pg";

export type SkillSummary = {
  skillKey: string;
  name: string;
  description: string | null;
  fileCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listSkills(): Promise<SkillSummary[]> {
  return await withTransaction(async (client) => {
    const result = await client.query<{
      skill_key: string;
      name: string | null;
      description: string | null;
      file_count: number;
      enabled: boolean | null;
      created_at: Date;
      updated_at: Date;
    }>(
      [
        "SELECT",
        "  s.skill_key,",
        "  COALESCE(",
        "    MAX(CASE WHEN s.path = '' THEN s.name END),",
        "    MIN(s.name),",
        "    s.skill_key",
        "  ) AS name,",
        "  MAX(CASE WHEN s.path = '' THEN s.description END) AS description,",
        "  COUNT(*) AS file_count,",
        "  COALESCE(",
        "    MAX(CASE WHEN s.path = '' THEN s.enabled::int END),",
        "    MAX(s.enabled::int),",
        "    1",
        "  ) = 1 AS enabled,",
        "  MIN(s.created_at) AS created_at,",
        "  MAX(s.updated_at) AS updated_at",
        "FROM skills s",
        "GROUP BY s.skill_key",
        "ORDER BY created_at DESC"
      ].join(" ")
    );

    return result.rows.map((row) => ({
      skillKey: row.skill_key,
      name: row.name ?? row.skill_key,
      description: row.description,
      fileCount: row.file_count,
      enabled: Boolean(row.enabled),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  });
}
