import { withTransaction } from "@/server/shared/db/pg";

type SkillFile = {
  path: string;
  name: string | null;
  description: string | null;
  content: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillDetail = {
  skillKey: string;
  name: string;
  description: string | null;
  files: SkillFile[];
};

export async function getSkillDetail(
  skillKey: string
): Promise<SkillDetail | null> {
  return await withTransaction(async (client) => {
    const result = await client.query<{
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
        "FROM skills",
        "WHERE skill_key = $1",
        "ORDER BY (path = '') DESC, path ASC"
      ].join(" "),
      [skillKey]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const files: SkillFile[] = result.rows.map((row) => ({
      path: row.path,
      name: row.name,
      description: row.description,
      content: row.content,
      contentType: row.content_type ?? "text/markdown",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));

    const root =
      files.find((file) => file.path === "") ??
      files[0] ?? {
        path: "",
        name: skillKey,
        description: null,
        content: "",
        contentType: "text/markdown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

    return {
      skillKey,
      name: root.name ?? skillKey,
      description: root.description,
      files
    };
  });
}

