# Bot RTS — Game Documentation

**Full design reference for mechanics, features, and in-game scenarios.**

Bot RTS is a real-time multiplayer strategy game where every unit is a **programmable robot** that you assemble from
modules. You can command a bot by hand from the GUI (manual micromanagement) or automate it by writing JavaScript.
Strategy is expressed as design and code: you design the machine, you write its brain, and you watch it compete in a
shared, persistent world.

> This document describes the **intended game design** gathered from the original [`notes.txt`](../archived-docs/notes.txt) (15 Jun 2024 and 21 Jan 2026),
> the codebase, and the decisions made while planning. Every point in these documents is decided (✅) or marked as
> planned (🔴); there are no open design questions (§20).
>
> **Status legend**
> ✅ Decided / implemented · 🟡 Partially implemented · 🔴 Not implemented (planned)
>
> This is a design document, not an engineering spec. For architecture, quality rules, and roadmap see
> [`README.md`](../../../README.md), [`AGENTS.md`](../../../AGENTS.md), [`2026-10-10.md`](../../quality-reviews/code/2026-10-10.md),
> [`DEVELOPMENT-PLAN.md`](../../development-plan/DEVELOPMENT-PLAN.md).

---

## Contents

Each section lives in its own file under [`game-design/`](./). Section numbers (`§12.2.1`) used
throughout the docs match the file numbers.

1. [Vision & pillars](./01-vision-pillars.md)
2. [Glossary](./02-glossary.md)
3. [Core game loop](./03-core-game-loop.md)
4. [The world and the map](./04-the-world-and-the-map.md)
5. [Player onboarding](./05-player-onboarding.md)
6. [The Base](./06-the-base.md)
7. [Modules](./07-modules.md)
8. [Bots](./08-bots.md)
9. [Resources, items & crafting](./09-resources-items-crafting.md)
10. [The script API](./10-the-script-api.md)
11. [The terminal (BotOS)](./11-the-terminal-botos.md)
12. [Real-time execution model](./12-real-time-execution-model.md)
13. [Security & sandboxing](./13-security-sandboxing.md)
14. [Concurrency & race conditions](./14-concurrency-race-conditions.md)
15. [Screens & HUD](./15-screens-hud.md)
16. [Economy & progression](./16-economy-progression.md)
17. [In-game scenarios](./17-in-game-scenarios.md)
18. [Example scripts](./18-example-scripts.md)
19. *(removed — status is tracked by the ✅/🟡/🔴 markers in each section and the README; the numbering is kept stable)*
20. [Open questions](./20-open-questions.md)
21. [Backlog (deliberately out of scope for now)](./21-backlog.md)
22. [Public API & integrations](./22-public-api-integrations.md)
23. [Achievements](./23-achievements.md)
24. [Game events and realtime notifications](./24-notifications-and-events.md)
25. [Admin console](./25-admin-console.md)
26. [Market and currency](./26-market-and-currency.md)
27. [Chat and transfers](./27-chat-and-transfers.md)
