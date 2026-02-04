# Aben

A cluster-controlled AI agent assistant system that automates computer operations.

## Introduction

Aben makes it easy to manage multiple AI assistant clusters. With simple configuration and an intuitive web interface, say goodbye to complex deployments and social media-based management.

## Features

- **Simple Configuration** — Client only needs server address and API key
- **Easy Deployment** — One-click install, ready to use
- **Visual Management** — Web UI to monitor all agents in real-time
- **No Social Apps Required** — No dependency on WeChat/Telegram for management

## Architecture

```
Python Client (N nodes)  ←→  Next.js Server  ←→  Next.js Admin (Web)
```

| Component | Tech Stack | Responsibility |
|-----------|------------|----------------|
| Client | Python | Execute automation tasks, report status |
| Server | Next.js | API services, data storage, task scheduling |
| Admin | Next.js | Web management UI, monitoring, task dispatch |

## Why Aben?

Compared to existing solutions like OpenClaw:

| Pain Point | Aben |
|------------|------|
| Complex configuration | ✅ Minimal setup |
| Managed via social apps | ✅ Professional Web UI |
| No visibility into status | ✅ Real-time monitoring |
| Tedious deployment | ✅ One-click deploy |

## Target Users

- Users managing automation tasks across multiple machines
- Teams deploying AI assistants at scale
- Developers seeking a simple and effective solution
