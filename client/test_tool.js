const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

// Define a tool with handleToolError set to true directly on the tool, which is a common LangChain practice.
const myToolWithHandling = tool(
    async ({ input }) => {
        throw new Error("Simulated failing tool");
    },
    {
        name: "failing_tool",
        description: "A tool that always fails",
        schema: z.object({ input: z.string() }),
        handleToolError: true,
    }
);

console.log("handleToolError:", myToolWithHandling.handleToolError);

const myTool2 = tool(
    async ({ input }) => {
        throw new Error("Simulated failing tool");
    },
    {
        name: "failing_tool_2",
        description: "A tool that always fails",
        schema: z.object({ input: z.string() }),
        handleToolErrors: true,
    }
);

console.log("handleToolErrors:", myTool2.handleToolErrors);
