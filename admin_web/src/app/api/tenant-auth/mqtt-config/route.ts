import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import * as jwt from "jsonwebtoken";

export const runtime = "nodejs";

/**
 * GET /api/tenant-auth/mqtt-config
 *
 * 管理端专用接口：通过 Web 端 Cookie 认证，
 * 返回当前系统的 MQTT 代理连接信息，并基于预设的 Secret 为此 Admin 签发连接用的 JWT 密码。
 */
export async function GET(request: Request) {
    // 1. 管理端身份认证
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const { tenantId, userId } = auth.context;

    // 2. 签发 JWT
    const secret = process.env.EMQX_SECRET || process.env.EMTX_SECRET || "emqxsecret";

    // Admin 端连接时使用的 ClientId
    const adminClientId = `admin_${tenantId}_${userId}_${Math.random().toString(16).substring(2, 8)}`;

    const token = jwt.sign(
        {
            sub: userId,
            clientid: adminClientId,
            role: "admin",
            tenantId
        },
        secret,
        {
            expiresIn: '1d', // Admin 端的 Token 经常刷新，有效期 1 天
        }
    );

    // 3. 读取连接配置
    // 如果是 web 端直连 EMQX，通常使用 WebSockets (WS/WSS)
    // 根据您的 .env 配置:
    // EMQX_WSS_PORT=8084
    // EMQX_WS_PORT=8083
    const host = process.env.MQTT_HOST || "111.228.5.253";

    // 如果你在使用 HTTPS, 通常需要 WSS
    const useWss = process.env.MQTT_TLS_INSECURE !== '1'; // 这里可以用您的配置决定
    const protocol = useWss ? "wss" : "ws";

    // 提取 WSS/WS 端口
    const port = Number(useWss ? (process.env.EMQX_WSS_PORT || 8084) : (process.env.EMQX_WS_PORT || 8083));

    return NextResponse.json({
        host,
        port,
        protocol,
        clientId: adminClientId, // 传给前端，前端直接用这个 ID 连接
        password: token,
        tenantId
    });
}
