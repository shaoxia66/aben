import { withTransaction } from "@/server/shared/db/pg";
import { updateSkillEnabled } from "@/server/skills/infra/pg-skills";

export async function setSkillEnabled(params: {
  skillKey: string;
  enabled: boolean;
}): Promise<void> {
  await withTransaction(async (client) => {
    await updateSkillEnabled(client, {
      skillKey: params.skillKey,
      enabled: params.enabled
    });
  });
}

