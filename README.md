A personal Discord engagement assistant designed for Web3, NFT, and crypto communities.

This bot helps you stay active, visible, and relevant in fast-moving Discord servers by generating reply suggestions and conversation starters privately, using local AI powered by Ollama.

No OpenAI keys.
No usage limits.
No auto-posting.
You stay human.

What This Bot Does

Suggests natural replies to ongoing conversations

Generates conversation starters for quiet channels

Works privately via DMs (never posts for you)

Supports multiple personas (degen, builder, collector)

Lets you paste conversations from servers where bots aren’t allowed

Batches alerts using digest mode to avoid spam

Runs entirely on your own machine using local AI

This is a thinking assistant, not a spam bot.

Why This Exists

Most Discord automation tools either:

spam messages, or

break server rules, or

require paid AI APIs

This bot does none of that.

It helps you:

respond faster

sound natural

stay consistently engaged

remain compliant with Discord and community rules

Especially useful for:

Web3 builders

NFT collectors

Community contributors

Ambassadors and mods

Anyone active in multiple Discord servers

Key Features

/draft
Generate reply suggestions for the current channel

/starter
Get conversation starters when chat is quiet

/paste draft
Paste conversations from any server and get reply ideas

/paste starter
Generate starters from pasted text

/set persona
Switch tone between degen, builder, or collector

/watch add
Monitor channels and get notified of reply opportunities

Digest mode
Batch alerts into periodic DMs instead of instant spam

How It Works (High Level)

Uses Ollama to run a local language model

Reads recent messages or pasted conversations

Generates short, human-sounding suggestions

Sends results privately to you via DM

Never auto-posts or impersonates you

You always decide what to send.

Requirements

Node.js 18+ (Node 20 or 24 recommended)

A Discord bot token

Ollama installed locally

A lightweight model (recommended: llama3.2:3b)

Works on Windows, macOS, and Linux.

Installation Summary

Install Ollama and pull a model

Clone this repository

Install dependencies

Create a .env file with your bot credentials

Configure config.json

Run node index.js

Full step-by-step instructions are included in the repository.

Usage Philosophy

This bot is intentionally designed to:

assist thinking, not automate posting

keep you compliant with Discord rules

preserve your personal voice

reduce burnout from constant typing

Best results come from:

lightly editing suggestions before sending

using digest mode for busy servers

switching personas based on context

Security & Privacy

No external API calls

No message logging beyond runtime memory

No data leaves your machine

.env is ignored by Git by default

Your conversations stay local.

Who This Is For

People active in Web3 / NFT Discords

Community contributors and ambassadors

Builders juggling multiple servers

Anyone who wants AI assistance without automation risk

Not intended for spam, bots-only servers, or impersonation.
