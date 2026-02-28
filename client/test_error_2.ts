import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createDeepAgent } from 'deepagents';

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

console.log("TypeScript definition of createDeepAgent parameters won't allow handleToolErrors natively:");
