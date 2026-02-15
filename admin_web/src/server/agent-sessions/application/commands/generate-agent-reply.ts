import type { Container } from "@/server/container";
import { withTransaction } from "@/server/shared/db/pg";
import {
  createAgentMessageRow,
  getNextAgentMessageSeq,
  listAgentMessagesBySessionId,
  lockAgentSessionForMessageAppend,
  touchAgentSessionLastMessageAt
} from "@/server/agent-sessions/infra/pg-agent-sessions";
import { getTenantDeepSeekChatModel } from "@/server/shared/llm/deepseek";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";

export class GenerateAgentReplyError extends Error {
  readonly code: "SESSION_NOT_FOUND" | "LLM_NOT_CONFIGURED" | "LLM_PROVIDER_NOT_SUPPORTED";

  constructor(code: GenerateAgentReplyError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "GenerateAgentReplyError";
  }
}

function toStringContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const anyP = p as any;
        if (typeof anyP.text === "string") return anyP.text;
        if (typeof anyP.content === "string") return anyP.content;
        return null;
      })
      .filter(Boolean) as string[];
    if (parts.length > 0) return parts.join("");
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? "");
  }
}

function messageRole(m: { authorType: string; contentJson: unknown }) {
  if (m && m.contentJson && typeof m.contentJson === "object" && "role" in (m.contentJson as any)) {
    const role = (m.contentJson as any).role;
    if (role === "user" || role === "assistant" || role === "system") return role as "user" | "assistant" | "system";
  }
  if (m.authorType === "agent") return "assistant";
  return "system";
}

export async function generateAgentReply(
  container: Container,
  params: { tenantId: string; sessionId: string; replyToMessageId: string | null }
) {
  const model = await getTenantDeepSeekChatModel({ tenantId: params.tenantId }).catch((err) => {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("未配置 DeepSeek API Key")) {
      throw new GenerateAgentReplyError("LLM_NOT_CONFIGURED", "未配置 DeepSeek 的 API Key");
    }
    throw err;
  });

  const history = await withTransaction(async (client) => {
    const locked = await lockAgentSessionForMessageAppend(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId
    });
    if (!locked) throw new GenerateAgentReplyError("SESSION_NOT_FOUND", "会话不存在");

    const messages = await listAgentMessagesBySessionId(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      limit: 200
    });

    return messages;
  });

  const tail = history.slice(Math.max(0, history.length - 50));
  const langchainMessages: BaseMessage[] = [new SystemMessage("你是一个有帮助的AI助手。")];
  for (const m of tail) {
    const content = m.content && m.content.trim() ? m.content : null;
    if (!content) continue;
    const role = messageRole(m);
    if (role === "user") langchainMessages.push(new HumanMessage(content));
    else if (role === "assistant") langchainMessages.push(new AIMessage(content));
    else langchainMessages.push(new SystemMessage(content));
  }

  const result = await model.invoke(langchainMessages);
  const assistantText = toStringContent((result as any)?.content);

  const created = await withTransaction(async (client) => {
    const locked = await lockAgentSessionForMessageAppend(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId
    });
    if (!locked) throw new GenerateAgentReplyError("SESSION_NOT_FOUND", "会话不存在");

    const seq = await getNextAgentMessageSeq(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId
    });

    const now = new Date();
    const message = await createAgentMessageRow(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      seq,
      authorType: "agent",
      authorId: null,
      content: assistantText,
      contentJson: { role: "assistant", provider: "deepseek" },
      replyToMessageId: params.replyToMessageId ?? null
    });

    await touchAgentSessionLastMessageAt(client, {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      lastMessageAt: now
    });

    return message;
  });

  await container.eventBus.publish({
    type: "agent_sessions.agent_message.appended",
    occurredAtMs: Date.now(),
    payload: {
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      messageId: created.id
    }
  });

  return created;
}

