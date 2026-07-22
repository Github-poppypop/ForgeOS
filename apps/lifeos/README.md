# LifeOS

**Owner:** CPO · **Engineering:** CTO · **Status:** Design (v1.0)

LifeOS is a personal operating system that models a human mind as structured,
versioned data and runs intelligent engines on top of it. It is the first
flagship app on the ForgeOS platform.

## What it does
LifeOS captures *who you are* (Brain DNA), *how you think about topics*
(Brain Slices), and *what you remember, intend, and aim for* (Memory / Mission
/ Goal engines), then lets autonomous Agents act on your behalf — all grounded
in a personal Knowledge Universe and extended through the Marketplace.

## Component Map
```
LifeOS
├── Brain DNA          # the schema of "you" (traits, values, identity)
├── Brain Slices       # topic-scoped views of your mind
├── Memory Engine      # episodic + semantic + procedural memory
├── Mission Engine     # purpose, principles, long-range intent
├── Goal Engine        # objectives, decomposition, execution tracking
├── Agent Engine       # autonomous agents bound to your Brain DNA
├── Knowledge Universe # your private, compounding memory store
└── Marketplace        # import/export capabilities, skills, slices
```

## Docs
Full architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
Per-component: [`docs/`](docs/)

## ForgeOS alignment
- Listed as a capability on the ForgeOS Marketplace (`/marketplace`).
- Consumes the Knowledge Universe core and Agent Runtime services.
- Agents are governed by the ForgeOS delegation protocol (`/agents`, `ORG.md §3`).
- **Federated brain:** LifeOS runs as its own isolated gbrain instance under
  the ForgeOS federation — ForgeOS reads down (oversight), LifeOS writes
  governance records up only. See `docs/GBRAIN-INTEGRATION.md` and
  `knowledge-universe/BRAIN-FEDERATION.md`.
