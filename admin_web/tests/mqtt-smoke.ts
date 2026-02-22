import crypto from 'node:crypto';
import mqtt from 'mqtt';
import { loadEnvFromFile } from './loadenv';

loadEnvFromFile('.env');
loadEnvFromFile('.env.development');

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

const host = process.env.MQTT_HOST ?? process.env.EMQX_HOST;
if (!host) throw new Error('缺少环境变量 MQTT_HOST 或 EMQX_HOST');

const protocol = (process.env.MQTT_PROTOCOL ?? 'mqtts').toLowerCase();
if (protocol !== 'mqtt' && protocol !== 'mqtts') {
  throw new Error('MQTT_PROTOCOL 仅支持 mqtt 或 mqtts');
}

const defaultPort = protocol === 'mqtt' ? '1883' : (process.env.EMQX_MQTTS_PORT ?? '8883');
const port = Number(process.env.MQTT_PORT ?? defaultPort);
if (!Number.isFinite(port) || port <= 0) throw new Error('MQTT_PORT 不是有效端口号');

const topic =
  process.env.MQTT_TEST_TOPIC ?? process.env.MQTT_TOPIC ?? 'v1/t/t_001/platform/event';
const qos = Number(process.env.MQTT_QOS ?? '1') as 0 | 1 | 2;

const clientId =
  process.env.MQTT_CLIENT_ID ?? `mqtt-smoke-${crypto.randomBytes(4).toString('hex')}`;

const username = process.env.MQTT_USERNAME ?? process.env.EMQX_USERNAME ?? undefined;
const password =
  process.env.MQTT_PASSWORD ??
  process.env.MQTT_TOKEN ??
  process.env.EMQX_PASSWORD ??
  undefined;

const url = `${protocol}://${host}:${port}`;
const tlsInsecure = process.env.MQTT_TLS_INSECURE === '1';

console.log('准备连接到 Broker', { url, clientId, topic, qos, tlsInsecure });

const client = mqtt.connect(url, {
  clientId,
  username,
  password,
  ...(protocol === 'mqtts' ? { rejectUnauthorized: !tlsInsecure } : {}),
  reconnectPeriod: 0,
  connectTimeout: Number(process.env.MQTT_CONNECT_TIMEOUT_MS ?? '5000')
});

let done = false;
const startedAt = Date.now();

function finishOk() {
  if (done) return;
  done = true;
  console.log('测试成功：已完成订阅与发布回环');
  client.end(true);
}

function finishFail(reason: string) {
  if (done) return;
  done = true;
  console.error(`测试失败：${reason}`);
  client.end(true);
  process.exitCode = 1;
}

client.on('connect', () => {
  console.log('已连接到 Broker', { url, clientId, topic, qos, tlsInsecure });

  client.subscribe(topic, { qos }, (subErr) => {
    if (subErr) {
      finishFail(`订阅失败：${subErr.message}`);
      return;
    }

    const payload = {
      ver: '1.0',
      id: `msg_${crypto.randomUUID()}`,
      ts: Date.now(),
      trace_id: `tr_${crypto.randomUUID()}`,
      tenant_id: process.env.MQTT_TENANT_ID ?? 't_001',
      sender: { type: 'voice', id: clientId },
      type: 'event.publish',
      payload: {
        event_name: 'test.mqtt.ping',
        data: { text: '你好，MQTT 8883 测试消息', client_id: clientId }
      }
    };

    client.publish(topic, JSON.stringify(payload), { qos }, (pubErr) => {
      if (pubErr) {
        finishFail(`发布失败：${pubErr.message}`);
        return;
      }
      console.log('已发布测试消息');
    });
  });
});

client.on('message', (receivedTopic, message) => {
  const costMs = Date.now() - startedAt;
  console.log('收到消息', { topic: receivedTopic, costMs });
  try {
    console.log(message.toString('utf-8'));
  } catch {
    console.log(message);
  }
  finishOk();
});

client.on('reconnect', () => {
  console.log('正在重连');
});

client.on('offline', () => {
  console.log('已离线');
});

client.on('close', () => {
  console.log('连接已关闭');
});

client.on('error', (err) => {
  finishFail(`连接错误：${err.message}`);
});

setTimeout(() => {
  if (done) return;
  finishFail('超时未收到回环消息（检查 TLS/认证/ACL/topic）');
}, Number(process.env.MQTT_TIMEOUT_MS ?? '10000'));
