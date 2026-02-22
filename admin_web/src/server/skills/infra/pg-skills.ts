import type { PoolClient } from "pg";

export type PgSkillFile = {
  skillKey: string;
  path: string;
  name: string | null;
  description: string | null;
  content: string;
  contentType: string;
};

export async function replaceSkillFiles(client: PoolClient, params: {
  skillKey: string;
  files: Array<{
    path: string;
    name: string | null;
    description: string | null;
    content: string;
    contentType: string;
  }>;
}): Promise<void> {
  await client.query("DELETE FROM skills WHERE skill_key = $1", [params.skillKey]);

  if (!params.files.length) {
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  params.files.forEach((file, index) => {
    const baseIndex = index * 6;
    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`
    );
    values.push(
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
      "INSERT INTO skills (skill_key, path, name, description, content, content_type)",
      `VALUES ${placeholders.join(", ")}`
    ].join(" "),
    values
  );
}

export async function updateSkillFileContent(client: PoolClient, params: {
  skillKey: string;
  path: string;
  content: string;
}): Promise<void> {
  await client.query(
    "UPDATE skills SET content = $3 WHERE skill_key = $1 AND path = $2",
    [params.skillKey, params.path, params.content]
  );
}

export async function updateSkillEnabled(client: PoolClient, params: {
  skillKey: string;
  enabled: boolean;
}): Promise<void> {
  await client.query(
    "UPDATE skills SET enabled = $2 WHERE skill_key = $1 AND path = ''",
    [params.skillKey, params.enabled]
  );
}



