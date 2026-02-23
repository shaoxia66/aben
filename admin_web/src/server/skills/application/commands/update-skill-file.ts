import { withTransaction } from "@/server/shared/db/pg";
import { updateSkillFileContent } from "@/server/skills/infra/pg-skills";

export async function updateSkillFile(params: {
  tenantId: string;
  skillKey: string;
  path: string;
  content: string;
}): Promise<void> {
  await withTransaction(async (client) => {
    await updateSkillFileContent(client, {
      tenantId: params.tenantId,
      skillKey: params.skillKey,
      path: params.path,
      content: params.content
    });
  });
}
