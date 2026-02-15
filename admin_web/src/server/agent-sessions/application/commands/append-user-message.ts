import { z } from "zod";
import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import {
  createAgentMessageRow,
  getNextAgentMessageSeq,
  lockAgentSessionForMessageAppend,
  touchAgentSessionLastMessageAt
} from "@/server/agent-sessions/infra/pg-agent-sessions";

const inputSchema = z.object({
  content: z.string().trim().min(1).max(8000)
});

export class AppendUserMessageError extends Error {
  readonly code: "SESSION_NOT_FOUND";

  constructor(code: AppendUserMessageError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "AppendUserMessageError";
  }
}

export async function appendUserMessage(
  container: Container,
  params: { tenantId: string; userId: string; sessionId: string; input: unknown }
) {
  const parsed = inputSchema.safeParse(params.input);
  if (!parsed.success) {
    throw parsed.error;
  }

  const created = await withTransaction(async (client) => {
    const locked = await lockAgentSessionForMessageAppend(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId
    });
    if (!locked) {
      throw new AppendUserMessageError("SESSION_NOT_FOUND", "会话不存在");
    }

    const seq = await getNextAgentMessageSeq(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId
    });

    const now = new Date();
    const message = await createAgentMessageRow(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      seq,
      authorType: "system",
      authorId: params.userId,
      content: parsed.data.content,
      contentJson: { role: "user" }
    });

    await touchAgentSessionLastMessageAt(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      lastMessageAt: now
    });

    return message;
  });

  await container.eventBus.publish({
    type: "agent_sessions.user_message.appended",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      messageId: created.id
    }
  });

  return created;
}

