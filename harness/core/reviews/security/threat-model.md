[← Security review method](./README.md)

# The threat model

A threat model is the part of the bindings that S5 and S6 stand on. It answers four questions: what are we working on, what can go wrong, what will we do about it, and did we do a good enough job (sources: `SHOSTACK` and `CS-THREAT` in [the probes of S5](./probes/S5-attack-surface.md), verified 2026-11-08). An agent drafts it from the project's code and documents; a person checks it, because the agent cannot know what the owners care about most.

Write it in the section "Threat model" of the bindings, short enough to read before each review:

1. **What is built.** The kinds of product (from [the list](./probes/README.md#kinds-of-product)) and the components, in a few lines.
2. **Assets.** What is worth protecting (data, money, accounts, the ability to publish), in order of value. Say who is harmed by each loss.
3. **Trust boundaries.** Where data or control passes from something less trusted to something more trusted: the browser to the server, a tenant to another, a service to a third party, a user's content to an agent.
4. **Entry points.** Each way in: pages, endpoints, uploads, webhooks, messages, background jobs, administrative consoles. An agent lists them from the routes and the configuration, and marks each boundary it crosses.
5. **Attackers.** Who would do this and with what access: an anonymous visitor, a registered user, another tenant, a former employee, a compromised dependency. Say which are in scope and which are accepted as out of scope.
6. **What can go wrong.** For each entry point and boundary, the failures that reach an asset. Prefer a short list tied to the assets to a long generic one.
7. **What is done about it.** For each, the defence that exists or the finding that will be opened, and the probes and scenarios that test it.
8. **Good enough?** Who checked it, on what date, and what was left out. A threat model that nobody but its author has read is a draft.

Update it when an entry point, an asset or a boundary changes. A review refreshes it at step 2 of the method.
