import Redis from "ioredis";

const redisUri = process.env.REDIS_URI || "redis://localhost:6379";
const redis = new Redis(redisUri, {
  db: Number(process.env.REDIS_DB || 0),
  lazyConnect: true,
});

export { redis };
