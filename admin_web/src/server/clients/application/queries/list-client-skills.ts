import { withTransaction } from "@/server/shared/db/pg";
import {
  listClientSkillsByTenantId,
  type PgClientSkillWithName
} from "@/server/clients/infra/pg-client-skills";

export type ClientSkillBinding = PgClientSkillWithName;

export async function listClientSkills(params: {
  tenantId: string;
}): Promise<ClientSkillBinding[]> {
  return await withTransaction(async (client) => {
    return await listClientSkillsByTenantId(client, params.tenantId);
  });
}

