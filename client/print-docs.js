const { createDeepAgent } = require('deepagents');
// To find out the exact argument names and structures for error handling
const { createSubAgentMiddleware, createFilesystemMiddleware } = require('deepagents');

// Using reflection to see what's available
import('deepagents').then(mod => {
    console.log(Object.keys(mod).filter(k => k.includes('Error') || k.includes('Exception') || k.includes('Tool')));
}).catch(console.error);
