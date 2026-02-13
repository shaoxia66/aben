"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.model = void 0;
var deepseek_1 = require("@langchain/deepseek");
var model = new deepseek_1.ChatDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: (_a = process.env.DEEPSEEK_MODEL_NAME) !== null && _a !== void 0 ? _a : 'deepseek-chat',
    temperature: 0.5,
});
exports.model = model;
