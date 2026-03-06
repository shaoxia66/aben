/**
 * skills.ts — Agent Skills 工具集
 *
 * 提供三个工具：
 *  1. load_skill           — 拉取 skill 的文档内容（SKILL.md + 参考文档）
 *  2. run_skill_script     — 从数据库拉取脚本内容，直接在本地执行
 */

import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

// ── 类型 ─────────────────────────────────────────────────────────────

export type SkillSummary = {
    skillKey: string
    name: string
    description: string | null
    hasScripts: boolean   // 是否包含可执行脚本文件
}

type SkillFile = {
    path: string           // "" = SKILL.md 根文件，其他为相对路径
    content: string
    contentType: string    // "text/markdown" | "text/x-python" | ...
}

type SkillDetail = {
    skillKey: string
    name: string
    files: SkillFile[]
}

// ── 内部工具函数 ──────────────────────────────────────────────────────

function readLocalAuthKey(): string {
    try {
        const file = join(app.getPath('userData'), 'aben-key.json')
        if (!existsSync(file)) return ''
        const data = JSON.parse(readFileSync(file, 'utf-8'))
        return typeof data.key === 'string' ? data.key : ''
    } catch {
        return ''
    }
}

/** 从后端拉取 skill 的全部文件内容 */
async function fetchSkillDetail(skillKey: string): Promise<SkillDetail | null> {
    const authKey = readLocalAuthKey()
    if (!authKey) return null

    const { net } = await import('electron')

    try {
        const res = await net.fetch(
            `http://localhost:3000/api/client-auth/skills/${encodeURIComponent(skillKey)}`,
            { headers: { Authorization: `Bearer ${authKey}` } }
        )
        if (!res.ok) {
            console.error(`[Skills] 拉取 skill "${skillKey}" 失败: HTTP ${res.status}`)
            return null
        }
        return await res.json() as SkillDetail
    } catch (err) {
        console.error(`[Skills] 拉取 skill "${skillKey}" 出错:`, err)
        return null
    }
}

/** 根据文件扩展名判断对应的执行器 */
function resolveInterpreter(scriptPath: string): { cmd: string; flag?: string } | null {
    const ext = scriptPath.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'py': return { cmd: 'python3' }
        case 'sh': return { cmd: 'bash' }
        case 'js': return { cmd: 'node' }
        case 'ts': return { cmd: 'npx', flag: 'tsx' }
        default: return null
    }
}

// ── 工具工厂 ─────────────────────────────────────────────────────────

/**
 * 工具 1：load_skill
 *
 * 读取 skill 的文档内容。只返回文本，不执行任何脚本，不写磁盘。
 * 适合：sql-mcp-first、nextjs-ddd 等纯文档类 skill。
 * 对于含脚本的 skill，文档内容会说明如何调用 run_skill_script。
 */
export function createLoadSkillTool(availableSkills: SkillSummary[]) {
    const skillList = availableSkills
        .map(s => `${s.skillKey}(${s.description ?? s.name})`)
        .join(', ')

    return new DynamicStructuredTool({
        name: 'load_skill',
        description:
            '加载指定技能(Skill)的指导文档，包括 SKILL.md 主文件和所有参考文档的文本内容。' +
            '当你认为某个技能与当前任务相关时，先调用此工具获取详细指引。' +
            `当前可用的技能: ${skillList}`,
        schema: z.object({
            skill_key: z.string().describe('要加载的技能标识符，例如 "sql-mcp-first"')
        }),
        func: async ({ skill_key }) => {
            const skill = availableSkills.find(s => s.skillKey === skill_key)
            if (!skill) {
                return `错误：未找到技能 "${skill_key}"。可用的技能: ${availableSkills.map(s => s.skillKey).join(', ')}`
            }

            console.log(`[Skills] 加载技能文档: ${skill_key}`)
            const detail = await fetchSkillDetail(skill_key)
            if (!detail) return `错误：无法获取技能 "${skill_key}" 的内容，请检查网络连接。`

            // 分类文件
            const rootFile = detail.files.find(f => f.path === '')
            const docFiles = detail.files.filter(f =>
                f.path !== '' && (f.contentType?.startsWith('text/markdown') || f.path.endsWith('.md'))
            )
            const scriptFiles = detail.files.filter(f =>
                f.path !== '' && !f.contentType?.startsWith('text/markdown') && !f.path.endsWith('.md')
            )

            let result = ''

            // 主文档
            if (rootFile) {
                result += rootFile.content + '\n\n'
            }

            // 参考文档
            if (docFiles.length > 0) {
                result += '---\n\n## 参考文档\n\n'
                for (const doc of docFiles) {
                    result += `### ${doc.path}\n\n${doc.content}\n\n`
                }
            }

            // 提示含脚本
            if (scriptFiles.length > 0) {
                result += '---\n\n> **注意**：此技能包含以下可执行脚本：\n'
                for (const f of scriptFiles) {
                    result += `> - \`${f.path}\`\n`
                }
                result += '>\n> 使用 `run_skill_script` 工具来执行这些脚本，无需手动下载。\n'
            }

            return result
        }
    })
}

/**
 * 工具 2：run_skill_script
 *
 * 从数据库拉取 skill 中的指定脚本内容，在本地临时执行后返回结果。
 * 脚本文件本身不会永久保存到磁盘（执行完自动删除）。
 * 传入的 args 参数仍然是真实的本地文件路径（输入/输出文件）。
 *
 * 适合：excalidraw/generate.py、任何 skill 中带 .py/.sh/.js 脚本的技能。
 */
export function createRunSkillScriptTool(availableSkills: SkillSummary[]) {
    // 只展示含脚本的技能
    const scriptSkills = availableSkills.filter(s => s.hasScripts)
    const skillList = scriptSkills.map(s => s.skillKey).join(', ')

    return new DynamicStructuredTool({
        name: 'run_skill_script',
        description:
            '执行指定技能(Skill)中的脚本文件。工具会自动从服务器获取脚本内容并在本地执行，' +
            '你只需提供脚本的参数（通常是输入/输出文件的路径）。' +
            `含有脚本的技能: ${skillList || '暂无'}`,
        schema: z.object({
            skill_key: z.string()
                .describe('技能的标识符，例如 "excalidraw"'),
            script_path: z.string()
                .describe('技能中脚本文件的相对路径，例如 "generate.py" 或 "scripts/build.sh"'),
            args: z.array(z.string()).default([])
                .describe('传递给脚本的命令行参数列表，通常是输入/输出文件的绝对路径'),
            timeout_seconds: z.number().int().min(1).max(300).default(60)
                .describe('脚本执行超时时间（秒），默认 60 秒'),
        }),
        func: async ({ skill_key, script_path, args, timeout_seconds }) => {
            // 1. 校验 skill 是否可用
            const skill = availableSkills.find(s => s.skillKey === skill_key)
            if (!skill) {
                return `错误：未找到技能 "${skill_key}"。可用: ${availableSkills.map(s => s.skillKey).join(', ')}`
            }

            console.log(`[Skills] 执行脚本: ${skill_key}/${script_path}`, args)

            // 2. 从后端拉取 skill 文件
            const detail = await fetchSkillDetail(skill_key)
            if (!detail) return `错误：无法获取技能 "${skill_key}" 的内容`

            // 3. 找到指定脚本文件
            const scriptFile = detail.files.find(f => f.path === script_path)
            if (!scriptFile) {
                const available = detail.files
                    .filter(f => f.path !== '')
                    .map(f => f.path)
                    .join(', ')
                return `错误：在技能 "${skill_key}" 中找不到脚本 "${script_path}"。可用文件: ${available}`
            }

            // 4. 确定执行器
            const interpreter = resolveInterpreter(script_path)
            if (!interpreter) {
                return `错误：不支持的脚本类型 "${script_path}"。支持: .py, .sh, .js, .ts`
            }

            // 5. 将脚本写入临时文件
            const ext = script_path.split('.').pop() ?? 'tmp'
            const tmpFile = join(tmpdir(), `aben-skill-${randomBytes(6).toString('hex')}.${ext}`)

            try {
                writeFileSync(tmpFile, scriptFile.content, { encoding: 'utf-8', mode: 0o755 })

                // 6. 构建执行命令
                // 对于 npx tsx 的情况，cmd = 'npx', flag = 'tsx'
                const cmdArgs = interpreter.flag
                    ? [interpreter.flag, tmpFile, ...args]
                    : [tmpFile, ...args]

                console.log(`[Skills] 执行: ${interpreter.cmd} ${cmdArgs.join(' ')}`)

                // 7. 执行脚本（同步，带超时）
                const result = spawnSync(interpreter.cmd, cmdArgs, {
                    encoding: 'utf-8',
                    timeout: timeout_seconds * 1000,
                    env: {
                        ...process.env,
                        // 注入 skill 上下文，让脚本可以感知自己是被 agent 调用的
                        ABEN_SKILL_KEY: skill_key,
                        ABEN_SKILL_SCRIPT: script_path,
                    }
                })

                // 8. 组装返回结果
                const lines: string[] = []

                if (result.stdout) {
                    lines.push('**输出 (stdout):**\n```\n' + result.stdout.trim() + '\n```')
                }
                if (result.stderr) {
                    lines.push('**错误 (stderr):**\n```\n' + result.stderr.trim() + '\n```')
                }
                if (result.error) {
                    if (result.error.message.includes('ETIMEDOUT') || result.signal === 'SIGTERM') {
                        lines.push(`**执行超时**（${timeout_seconds}秒）`)
                    } else {
                        lines.push(`**执行错误**: ${result.error.message}`)
                    }
                }

                const exitMsg = result.status === 0
                    ? '✅ 脚本执行成功'
                    : `❌ 脚本退出码: ${result.status}`

                return [exitMsg, ...lines].join('\n\n')

            } finally {
                // 9. 清理临时脚本文件（无论成功失败都删除）
                try {
                    unlinkSync(tmpFile)
                } catch {
                    // 忽略删除失败
                }
            }
        }
    })
}

// ── 对外导出 ─────────────────────────────────────────────────────────

/**
 * 根据 skills 元数据列表，创建所有 skill 相关工具
 */
export function createSkillTools(availableSkills: SkillSummary[]): StructuredTool[] {
    const tools: StructuredTool[] = [
        createLoadSkillTool(availableSkills) as unknown as StructuredTool,
    ]

    // 只有存在含脚本的 skill 时，才注册 run_skill_script 工具
    if (availableSkills.some(s => s.hasScripts)) {
        tools.push(createRunSkillScriptTool(availableSkills) as unknown as StructuredTool)
    }

    console.log(`[Skills] 注册了 ${tools.length} 个 skill 工具，当前 skills: ${availableSkills.map(s => s.skillKey).join(', ')}`)
    return tools
}
