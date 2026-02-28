const { createDeepAgent, LocalShellBackend } = require('deepagents');
const { MemorySaver } = require('@langchain/langgraph-checkpoint');
const { ChatOpenAI } = require('@langchain/openai');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

const buggyTool = tool(
    async (input) => {
        console.log("Buggy tool executed!");
        throw new Error('This is a simulated tool error: ' + input.reason);
    },
    {
        name: 'buggy_tool',
        description: 'A tool that always throws an error. Good for testing.',
        schema: z.object({
            reason: z.string().describe("the reason we want it to fail"),
        }),
    }
);

async function run() {
    process.env.OPENAI_API_KEY = "sk-fake-key"; // Using fake key just to see if it instantiates

    const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0,
    });

    try {
        const agent = createDeepAgent({
            model: llm,
            tools: [buggyTool],
            // handleToolErrors top-level does not exist in CreateDeepAgentParams type based on what I saw
            systemPrompt: "You are a test agent."
        });
        console.log("Agent built successfully.");
    } catch (e) {
        console.error("Agent creation failed:", e.message);
    }
}

run();
