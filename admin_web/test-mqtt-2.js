const mqtt = require('mqtt');
const jwt = require('jsonwebtoken');

const secret = '8s7d6f9g8h7j9k8l7m9n8b7v9c8x7z9a8s7d6f9g8h';
const token = jwt.sign({
    sub: 'test',
    clientid: 'test_client_id_123',
    role: 'admin'
}, secret, { expiresIn: '1d' });

const client = mqtt.connect('wss://111.228.5.253:8084/mqtt', {
    clientId: 'test_client_id_123',
    username: 'admin',
    password: token,
    rejectUnauthorized: false
});

client.on('connect', () => {
    console.log('Connected WSS!');
    client.end();
});
client.on('error', (err) => {
    console.error('WSS Error:', err.message);
    client.end();
});
