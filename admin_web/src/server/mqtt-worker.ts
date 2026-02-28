import mqtt from "mqtt";
import * as jwt from "jsonwebtoken";
import { withTransaction } from "@/server/shared/db/pg";
import { getEmqxOnlineClients } from "@/server/shared/infra/emqx-api";

let backendMqttClient: mqtt.MqttClient | null = null;
export function getMqttBackendClient() {
    return backendMqttClient;
}

export function startMqttServerWorker() {
    const flag = Symbol.for("aben.mqtt_worker");
    const anyGlobal = globalThis as unknown as Record<string | symbol, unknown>;

    if (anyGlobal[flag]) {
        backendMqttClient = anyGlobal[Symbol.for("aben.mqtt_client")] as mqtt.MqttClient | null;
        return;
    }
    anyGlobal[flag] = true;

    const secret = process.env.EMQX_SECRET || process.env.EMTX_SECRET || "emqxsecret";
    const adminClientId = `backend_server_${Math.random().toString(16).substring(2, 8)}`;

    const token = jwt.sign(
        { sub: "backend", clientid: adminClientId, role: "backend" },
        secret,
        { expiresIn: "7d" }
    );

    const host = process.env.MQTT_HOST || "111.228.5.253";
    const port = Number(process.env.MQTT_PORT || process.env.EMQX_MQTTS_PORT || 8883);
    const protocol = process.env.MQTT_PROTOCOL || "mqtts";
    const brokerUrl = `${protocol}://${host}:${port}`;

    console.log(`[MQTT Background Worker] Connecting to ${brokerUrl}...`);
    const client = mqtt.connect(brokerUrl, {
        username: "backend",
        password: token,
        clientId: adminClientId,
        rejectUnauthorized: false,
    });

    backendMqttClient = client;
    anyGlobal[Symbol.for("aben.mqtt_client")] = client;

    client.on("connect", () => {
        console.log("[MQTT Background Worker] Connected successfully!");
    });

    client.on("error", (err) => {
        console.error(`[MQTT Background Worker] Connection error:`, err.message);
    });

    // 定期同步 EMQX 状态 (每 30 秒)
    // 作为一个兜底方案，防止错过 LWT 或在线消息
    setInterval(async () => {
        try {
            const onlineClientIds = await getEmqxOnlineClients();
            const onlineSet = new Set(onlineClientIds);

            await withTransaction(async (pgClient) => {
                // 获取所有注册的客户端 Code
                const result = await pgClient.query<{ id: string, code: string }>("SELECT id, code FROM clients WHERE status = 'enabled'");

                for (const row of result.rows) {
                    const isOnline = onlineSet.has(row.code) || onlineSet.has(row.id);
                    const runStatus = isOnline ? "running" : "offline";

                    // 这里可以优化，只在状态变化时更新
                    await pgClient.query(
                        "UPDATE clients SET run_status = $1, last_seen_at = NOW() WHERE id = $2 AND (run_status != $1 OR run_status IS NULL)",
                        [runStatus, row.id]
                    );
                }
            });
            // console.log(`[MQTT Background Worker] Periodically synced ${onlineClientIds.length} online clients from EMQX.`);
        } catch (err) {
            console.error("[MQTT Background Worker] Error in periodic sync:", err);
        }
    }, 30000);
}
