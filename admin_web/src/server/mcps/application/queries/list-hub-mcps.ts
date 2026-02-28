import { withTransaction } from "@/server/shared/db/pg";

export type HubMcpSummary = {
    id: string;
    mcpKey: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    config: Record<string, unknown>;
    author: string | null;
    version: string;
    githubUrl: string | null;
    siteUrl: string | null;
    isPublished: boolean;
    updatedAt: string;
};

export async function listHubMcps(): Promise<HubMcpSummary[]> {
    return await withTransaction(async (client) => {
        const result = await client.query<{
            id: string;
            mcp_key: string;
            name: string;
            description: string | null;
            icon_url: string | null;
            config: Record<string, unknown>;
            author: string | null;
            version: string;
            github_url: string | null;
            site_url: string | null;
            is_published: boolean;
            updated_at: Date;
        }>(
            [
                "SELECT id, mcp_key, name, description, icon_url, config, author, version,",
                "  github_url, site_url, is_published, updated_at",
                "FROM mcp_hub",
                "WHERE is_published = true",
                "ORDER BY updated_at DESC"
            ].join(" ")
        );

        return result.rows.map((row) => ({
            id: row.id,
            mcpKey: row.mcp_key,
            name: row.name,
            description: row.description,
            iconUrl: row.icon_url,
            config: (row.config ?? {}) as Record<string, unknown>,
            author: row.author,
            version: row.version,
            githubUrl: row.github_url,
            siteUrl: row.site_url,
            isPublished: row.is_published,
            updatedAt: row.updated_at.toISOString()
        }));
    });
}
