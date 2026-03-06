import { NextResponse } from "next/server";
import { requireClientAuth } from "@/server/auth/infra/require-client-auth";
import { getSkillDetail } from "@/server/skills/application/queries/get-skill-detail";
import { withTransaction } from "@/server/shared/db/pg";

export const runtime = "nodejs";

/**
 * GET /api/client-auth/skills/[skillKey]
 *
 * 客户端专用接口：通过 auth_key 认证，返回指定 skill 的全部文件内容。
 * 包括 SKILL.md 主文件和所有参考文件（文档 + 脚本）。
 *
 * 客户端工具（load_skill / run_skill_script）调用此接口按需拉取内容，
 * 而不是在启动时全量下载到本地。
 *
 * Authorization: Bearer <auth_key>
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ skillKey: string }> }
) {
    // 1. 客户端密钥认证
    const auth = await requireClientAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const { tenantId } = auth.context;
    const { skillKey } = await context.params;

    if (!skillKey || skillKey.trim() === "") {
        return NextResponse.json(
            { error: { code: "INVALID_PARAM", message: "skillKey 不能为空" } },
            { status: 400 }
        );
    }

    // 2. 查询 skill 完整内容（复用已有的 getSkillDetail）
    const detail = await getSkillDetail(tenantId, skillKey);

    if (!detail) {
        return NextResponse.json(
            { error: { code: "NOT_FOUND", message: `Skill "${skillKey}" 不存在或未授权访问` } },
            { status: 404 }
        );
    }

    // 3. 返回完整文件列表
    // files 数组：
    //   - path = ""              → SKILL.md 主文件
    //   - path = "generate.py"  → 脚本文件（content_type = text/x-python）
    //   - path = "refs/foo.md"  → 参考文档（content_type = text/markdown）
    return NextResponse.json(detail);
}
