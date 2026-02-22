import { Buffer } from "node:buffer";
import JSZip from "jszip";
import { withTransaction } from "@/server/shared/db/pg";
import { replaceSkillFiles } from "@/server/skills/infra/pg-skills";

export class ImportSkillError extends Error {
  code: "INVALID_ARCHIVE" | "NO_MARKDOWN_FILES";

  constructor(code: ImportSkillError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ImportSkillError";
  }
}

type ParsedSkillFile = {
  path: string;
  content: string;
};

type Frontmatter = {
  name: string | null;
  description: string | null;
};

function parseFrontmatter(markdown: string): Frontmatter {
  const lines = markdown.split(/\r?\n/);
  if (!lines.length || lines[0]!.trim() !== "---") {
    return { name: null, description: null };
  }

  const frontmatterLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "---") {
      break;
    }
    frontmatterLines.push(line);
  }

  let name: string | null = null;
  let description: string | null = null;

  for (const line of frontmatterLines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key === "name") name = value || null;
    if (key === "description") description = value || null;
  }

  return { name, description };
}

function getSkillKeyFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(skill|zip)$/i, "");
  return base || "skill";
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export async function importSkillFromZip(params: {
  fileName: string;
  buffer: ArrayBuffer;
}): Promise<{ skillKey: string; fileCount: number }> {
  const inputBuffer = Buffer.from(params.buffer);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(inputBuffer);
  } catch {
    throw new ImportSkillError("INVALID_ARCHIVE", "上传的文件不是有效的 zip 压缩包");
  }

  const rawFiles: ParsedSkillFile[] = [];

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const relPath = normalizePath(entry.name);
    if (!relPath.toLowerCase().endsWith(".md")) continue;
    const content = await entry.async("string");
    rawFiles.push({ path: relPath, content });
  }

  if (!rawFiles.length) {
    throw new ImportSkillError("NO_MARKDOWN_FILES", "skill 压缩包中没有找到任何 markdown 文件");
  }

  const topLevels = new Set<string>();
  for (const file of rawFiles) {
    const segments = file.path.split("/").filter(Boolean);
    if (segments.length <= 1) {
      topLevels.add("");
    } else {
      topLevels.add(segments[0]!);
    }
  }

  let skillKey: string;
  let basePrefix: string | null = null;

  if (topLevels.size === 1) {
    const only = Array.from(topLevels)[0]!;
    if (only === "") {
      skillKey = getSkillKeyFromFileName(params.fileName);
      basePrefix = null;
    } else {
      skillKey = only;
      basePrefix = `${only}/`;
    }
  } else {
    skillKey = getSkillKeyFromFileName(params.fileName);
    basePrefix = null;
  }

  const filesRelativeToSkill: ParsedSkillFile[] = rawFiles.map((file) => {
    let relativePath = file.path;
    if (basePrefix && relativePath.startsWith(basePrefix)) {
      relativePath = relativePath.slice(basePrefix.length);
    }
    relativePath = normalizePath(relativePath);
    return { path: relativePath, content: file.content };
  });

  let rootName: string | null = null;
  let rootDescription: string | null = null;
  let rootContent = "";
  let rootIndex = -1;

  for (let i = 0; i < filesRelativeToSkill.length; i++) {
    const file = filesRelativeToSkill[i]!;
    const lower = file.path.toLowerCase();
    if (lower === "skill.md") {
      const fm = parseFrontmatter(file.content);
      rootName = fm.name ?? skillKey;
      rootDescription = fm.description;
      rootContent = file.content;
      rootIndex = i;
      break;
    }
  }

  const filesForInsert: {
    path: string;
    name: string | null;
    description: string | null;
    content: string;
    contentType: string;
  }[] = [];

  filesForInsert.push({
    path: "",
    name: rootName ?? skillKey,
    description: rootDescription,
    content: rootContent || (rootIndex >= 0 ? filesRelativeToSkill[rootIndex]!.content : ""),
    contentType: "text/markdown"
  });

  filesRelativeToSkill.forEach((file, index) => {
    if (index === rootIndex) return;
    filesForInsert.push({
      path: file.path,
      name: null,
      description: null,
      content: file.content,
      contentType: "text/markdown"
    });
  });

  await withTransaction(async (client) => {
    await replaceSkillFiles(client, {
      skillKey,
      files: filesForInsert
    });
  });

  return {
    skillKey,
    fileCount: filesForInsert.length
  };
}
