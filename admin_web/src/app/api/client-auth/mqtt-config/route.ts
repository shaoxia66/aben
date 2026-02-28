import { NextResponse } from "next/server";
import { requireClientAuth } from "@/server/auth/infra/require-client-auth";
import * as jwt from "jsonwebtoken";

export const runtime = "nodejs";

/**
 * GET /api/client-auth/mqtt-config
 *
 * 客户端专用接口：通过 auth_key 认证，
 * 返回当前系统的 MQTT 代理连接信息，并基于预设的 Secret 为此客户端签发连接用的 JWT 密码。
 *
 * Authorization: Bearer <auth_key>
 */
export async function GET(request: Request) {
    // 1. 客户端密钥认证
    const auth = await requireClientAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const { clientId, code } = auth.context;

    // 2. 签发 JWT
    // 读取 EMQX 配置中的 JWT HMAC Secret
    const secret = process.env.EMQX_SECRET || process.env.EMTX_SECRET || "emqxsecret";

    // 生成基于对应该客户端信息的 JWT（作为 MQTT 的 password 进行连接）
    const token = jwt.sign(
        {
            sub: clientId,
            clientid: clientId // 改为使用 UUID 作为 MQTT clientid
        },
        secret,
        {
            expiresIn: '30d', // JWT 有效期设为 30 天，可根据安全要求调整
        }
    );

    // 3. 读取并下发 MQTT 连接基础配置
    const host = process.env.MQTT_HOST || "111.228.5.253";
    const port = Number(process.env.MQTT_PORT || process.env.EMQX_MQTTS_PORT || 8883);
    const protocol = process.env.MQTT_PROTOCOL || "mqtts";

    return NextResponse.json({
        host,
        port,
        protocol,
        password: token // JWT 被设计为 MQTT 连接密码
    });
}
