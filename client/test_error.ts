import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createDeepAgent, LocalShellBackend } from 'deepagents';

const myTool = tool(
    async (input) => {
        throw new Error('This is a simulated tool error: ' + input.reason);
    },
    {
        name: 'buggy_tool',
        description: 'A tool that always throws an error. Good for testing.',
        schema: z.object({
            reason: z.string()
        })
    }
);

console.log("Creating agent...");
// This code doesn't actually call OpenAI so it's fine
const agent = createDeepAgent({
    model: "claude-sonnet-4-5-20250929",
    tools: [myTool],
    handleToolErrors: true 
} as any);
console.log("Agent created");
