import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { importSkillFromZip, ImportSkillError } from "@/server/skills/application/commands/import-skill-from-zip";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireTenantAuth(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.status }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "请求体不能为空" } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "缺少要上传的文件" } },
      { status: 400 }
    );
  }

  const fileName = file.name || "skill.skill";
  if (!fileName.toLowerCase().endsWith(".skill")) {
    return NextResponse.json(
      { error: { code: "INVALID_FILE_TYPE", message: "仅支持 .skill 后缀的文件" } },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    const result = await importSkillFromZip({
      fileName,
      buffer: arrayBuffer
    });

    return NextResponse.json({
      skillKey: result.skillKey,
      fileCount: result.fileCount
    });
  } catch (err) {
    if (err instanceof ImportSkillError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "导入 skill 失败" } },
      { status: 500 }
    );
  }
}

