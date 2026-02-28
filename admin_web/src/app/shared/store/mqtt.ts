import { create } from 'zustand';
import mqtt, { MqttClient } from 'mqtt';

interface ClientPresence {
    status: 'online' | 'offline';
    timestamp: number;
    version?: string;
}

interface MqttState {
    client: MqttClient | null;
    isConnected: boolean;
    error: Error | null;
    presences: Record<string, ClientPresence>; // clientId -> presence

    // Actions
    connect: () => Promise<void>;
    disconnect: () => void;
    publishCommand: (targetClientId: string, command: any) => void;
}

export const useMqttStore = create<MqttState>((set, get) => ({
    client: null,
    isConnected: false,
    error: null,
    presences: {},

    connect: async () => {
        const { client } = get();
        if (client) return; // Already connected or connecting

        try {
            // 1. Fetch credentials from our new API endpoint
            const res = await fetch('/api/tenant-auth/mqtt-config');
            if (!res.ok) {
                throw new Error(`Failed to fetch MQTT config: ${res.status}`);
            }

            const config = await res.json();
            const { host, port, protocol, clientId, password } = config;

            const brokerUrl = `${protocol}://${host}:${port}/mqtt`;

            // 2. Establish connection
            const newClient = mqtt.connect(brokerUrl, {
                username: 'admin_web',
                password,
                clientId,
                rejectUnauthorized: false,
            });

            newClient.on('connect', () => {
                set({ isConnected: true, error: null });

                // Subscribe to all client presences
                newClient.subscribe('client/+/status');
            });

            newClient.on('message', (topic, message) => {
                // Handle presence updates
                // Topic format: client/{clientId}/status
                if (topic.startsWith('client/') && topic.endsWith('/status')) {
                    const targetClientId = topic.split('/')[1];
                    try {
                        const payload = JSON.parse(message.toString());
                        set((state) => ({
                            presences: {
                                ...state.presences,
                                [targetClientId]: payload
                            }
                        }));
                    } catch (e) {
                        console.error('Failed to parse presence payload', e);
                    }
                }
            });

            newClient.on('error', (err) => {
                set({ error: err });
            });

            newClient.on('close', () => {
                set({ isConnected: false });
            });

            set({ client: newClient });

        } catch (err: any) {
            set({ error: err });
        }
    },

    disconnect: () => {
        const { client } = get();
        if (client) {
            client.end();
            set({ client: null, isConnected: false });
        }
    },

    publishCommand: (targetClientId: string, command: any) => {
        const { client, isConnected } = get();
        if (client && isConnected) {
            client.publish(`client/${targetClientId}/command`, JSON.stringify(command));
        } else {
            console.warn('Cannot publish command: MQTT not connected');
        }
    }
}));
