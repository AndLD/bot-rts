[← Game design index](./GAME-DESIGN.md)

# 3. Core game loop

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
        ▼                                                          │
 1. Explore  ──►  2. Scan  ──►  3. Mine / Pick  ──►  4. Store       │
 (move bots)     (find cells)    (drill, grab)      (base/storage)  │
        ▲                                              │            │
        │                                              ▼            │
 7. Deploy  ◄──  6. Assemble  ◄──  5. Craft  ◄─────────┘            │
 (spawn bot)      (combine         (modules from                    │
                   modules)         resources +                      │
                                    blueprints)                     │
        │                                                          │
        └──────────────── write better scripts ◄────────────────────┘
```

1. **Explore** — move bots to reveal the map.
2. **Scan** — scanner modules reveal nearby cells (fog of war).
3. **Mine / Pick** — drills extract resources; manipulators pick up items.
4. **Store** — carry resources back to the base or into storage modules.
5. **Craft** — spend resources + blueprints to build modules in the factory.
6. **Assemble** — combine modules into a new bot.
7. **Deploy** — the bot spawns next to the base and its control-block id registers in the base.
8. **Program** — connect to the bot's terminal, write/refine scripts, `run` them.

Every step can be done by hand from the GUI (§15.1) or by script. The loop is an *automation* loop as much as a resource
loop: every repetitive manual action you find becomes a script you improve.
