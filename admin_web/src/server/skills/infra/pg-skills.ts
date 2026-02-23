import type { PoolClient } from "pg";

export type PgSkillFile = {
  tenantId: string;
  skillKey: string;
  path: string;
  name: string | null;
  description: string | null;
  content: string;
  contentType: string;
};

export async function replaceSkillFiles(client: PoolClient, params: {
  tenantId: string;
  skillKey: string;
  files: Array<{
    path: string;
    name: string | null;
    description: string | null;
    content: string;
    contentType: string;
  }>;
}): Promise<void> {
  await client.query(
    "DELETE FROM skills WHERE tenant_id = $1 AND skill_key = $2",
    [params.tenantId, params.skillKey]
  );

  if (!params.files.length) {
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  params.files.forEach((file, index) => {
    const baseIndex = index * 7;
    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`
    );
    values.push(
      params.tenantId,
      params.skillKey,
      file.path,
      file.name,
      file.description,
      file.content,
      file.contentType
    );
  });

  await client.query(
    [
      "INSERT INTO skills (tenant_id, skill_key, path, name, description, content, content_type)",
      `VALUES ${placeholders.join(", ")}`
    ].join(" "),
    values
  );
}

export async function updateSkillFileContent(client: PoolClient, params: {
  tenantId: string;
  skillKey: string;
  path: string;
  content: string;
}): Promise<void> {
  await client.query(
    "UPDATE skills SET content = $4 WHERE tenant_id = $1 AND skill_key = $2 AND path = $3",
    [params.tenantId, params.skillKey, params.path, params.content]
  );
}

