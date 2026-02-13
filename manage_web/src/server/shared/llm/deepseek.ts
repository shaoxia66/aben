import { ChatDeepSeek } from "@langchain/deepseek";

const model = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL_NAME ?? 'deepseek-chat',
  temperature: 0.5,
});

export { model };
