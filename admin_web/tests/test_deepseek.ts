import { loadEnvFromFile } from './loadenv';
loadEnvFromFile('.env.development');
console.log(process.env.LANGFUSE_SECRET_KEY);
import {
  langfuseHandler,
  ensureLangfuseOtelSdkStarted,
  shutdownLangfuseOtelSdk
} from '../src/server/shared/telemetry/langfuse';

async function main() {


  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('缺少环境变量 DEEPSEEK_API_KEY');
  }

  await ensureLangfuseOtelSdkStarted();



  const { model } = await import('../src/server/shared/llm/deepseek');


  const result = await model.invoke(
    [{ role: 'user', content: '你好，你的爸爸是谁' }],
    { callbacks: [langfuseHandler],runName:'测试deepseek' }
  );
  console.log(result);

  await shutdownLangfuseOtelSdk();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

