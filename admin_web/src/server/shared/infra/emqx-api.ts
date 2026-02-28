import { cache } from "react";

export interface EmqxClientInfo {
    clientid: string;
    connected: boolean;
    connected_at: string;
    disconnected_at?: string;
    ip_address: string;
    keepalive: number;
    proto_name: string;
    proto_ver: number;
}

export interface EmqxClientsResponse {
    data: EmqxClientInfo[];
    meta: {
        page: number;
        limit: number;
        count: number;
        hasnext: boolean;
    };
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAuthToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const host = process.env.MQTT_HOST || "111.228.5.253";
    const port = process.env.EMQX_DASHBOARD_PORT || "18083";
    const password = process.env.EMQX_DASHBOARD_PASSWORD || "public";
    const username = "admin";

    try {
        const res = await fetch(`http://${host}:${port}/api/v5/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            throw new Error(`Failed to login to EMQX: ${res.statusText}`);
        }

        const data = await res.json();
        cachedToken = data.token;
        // Token usually lasts for a long time, but let's refresh it every hour
        tokenExpiresAt = Date.now() + 3600 * 1000;
        return cachedToken;
    } catch (err) {
        console.error("[EMQX API] Login error:", err);
        throw err;
    }
}

export async function getEmqxOnlineClients(): Promise<string[]> {
    const host = process.env.MQTT_HOST || "111.228.5.253";
    const port = process.env.EMQX_DASHBOARD_PORT || "18083";

    try {
        const token = await getAuthToken();
        const res = await fetch(`http://${host}:${port}/api/v5/clients?connected=true`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch EMQX clients: ${res.statusText}`);
        }

        const data: EmqxClientsResponse = await res.json();
        return data.data.map((c) => c.clientid);
    } catch (err) {
        console.error("[EMQX API] Error fetching online clients:", err);
        return [];
    }
}
