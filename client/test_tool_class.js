const { DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");

const tool = new DynamicStructuredTool({
  name: "failing_tool",
  description: "A tool that fails",
  schema: z.object({ input: z.string() }),
  func: async () => { throw new Error("I failed") },
});

console.log("Before setting expected handle errors in DynamicStructuredTool:", Object.keys(tool).filter(k => k.toLowerCase().includes('error')));
