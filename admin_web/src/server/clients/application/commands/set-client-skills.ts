import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import {
  setClientSkillsForClient,
  setClientSkillEnabled,
  type PgClientSkill
} from "@/server/clients/infra/pg-client-skills";

const setSkillsSchema = z.object({
  skillKeys: z.array(z.string().min(1).max(100)).max(200)
});

const setSkillEnabledSchema = z.object({
  enabled: z.boolean()
});

export async function setClientSkills(
  container: Container,
  params: { tenantId: string; userId: string; clientId: string; input: unknown }
): Promise<PgClientSkill[]> {
  const parsed = setSkillsSchema.parse(params.input);
  const distinctSkillKeys = Array.from(new Set(parsed.skillKeys));

  const rows = await withTransaction(async (client) => {
    return await setClientSkillsForClient(client, {
      tenantId: params.tenantId,
      clientId: params.clientId,
      skillKeys: distinctSkillKeys
    });
  });

  await container.eventBus.publish({
    type: "clients.client.skills.set",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      clientId: params.clientId,
      skillKeys: distinctSkillKeys
    }
  });

  return rows;
}

export async function setClientSkillEnabledCommand(
  container: Container,
  params: { tenantId: string; userId: string; clientId: string; skillKey: string; input: unknown }
): Promise<PgClientSkill> {
  const parsed = setSkillEnabledSchema.parse(params.input);

  const row = await withTransaction(async (client) => {
    return await setClientSkillEnabled(client, {
      tenantId: params.tenantId,
      clientId: params.clientId,
      skillKey: params.skillKey,
      enabled: parsed.enabled
    });
  });

  await container.eventBus.publish({
    type: "clients.client.skill.enabled_changed",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      clientId: params.clientId,
      skillKey: params.skillKey,
      enabled: row.enabled
    }
  });

  return row;
}

