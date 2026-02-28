import { NextResponse } from "next/server";
import { requireTenantAuth } from "@/server/auth/infra/require-tenant-auth";
import { getMqttBackendClient } from "@/server/mqtt-worker";

export const runtime = "nodejs";

export async function POST(
    request: Request,
    { params }: { params: { clientId: string } }
) {
    const auth = await requireTenantAuth(request);
    if (!auth.ok) {
        return NextResponse.json(
            { error: { code: auth.error.code, message: auth.error.message } },
            { status: auth.error.status }
        );
    }

    const payload = await request.json();
    const mqClient = getMqttBackendClient();

    if (!mqClient || !mqClient.connected) {
        return NextResponse.json({ error: "Backend MQTT connection not ready." }, { status: 503 });
    }

    // Use the ID from params, which in the UI could also be the client's `code` when sending
    const targetId = params.clientId;
    mqClient.publish(`client/${targetId}/command`, JSON.stringify(payload), { qos: 1 });

    return NextResponse.json({ success: true });
}
