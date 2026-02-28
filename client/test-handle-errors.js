const { createDeepAgent } = require('deepagents');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

const buggyTool = tool(
    async (input) => {
        throw new Error('This is a simulated tool error: ' + input.reason);
    },
    {
        name: 'buggy_tool',
        description: 'A tool that always throws an error',
        schema: z.object({
            reason: z.string(),
        }),
    }
);

(async () => {
    try {
        const agent = createDeepAgent({
            model: "claude-sonnet-4-5-20250929",
            tools: [buggyTool],
            handleToolErrors: true // Let's see if this option exists and works
        });
        console.log("Agent created successfully with handleToolErrors: true");
    } catch (e) {
        console.error("Agent creation failed:", e.message);
    }
})();
