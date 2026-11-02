<!-- The managed block "non-negotiables" of the entry file (its section 1), rendered with the profile file by `harness sync`. Each rule carries a stable id in a comment. -->
The principles (SOLID, scalability, testability, maintainability, low coupling, Git Flow, tests for every feature) are in
[method §1]({{rel:documents.method}}#1-principles). If a rule conflicts with existing legacy code, the rule wins for **new
and modified** code — refactor the touched area to comply rather than perpetuating the anti-pattern.

Non-negotiables (a PR that violates these is rejected). **Changing one needs the owner's explicit confirmation of that change**, recorded
in the pull request; a mention in passing ("the gate is annoying") is not a confirmation, so ask. <!-- rule:nn.change -->

1. Every feature ships with **unit + integration tests**, and user-visible flows get **e2e** tests. <!-- rule:nn.tests -->
2. Coverage must stay at or above the coverage gate ([profile]({{rel:paths.profileDocument}}#2-quality-gates)); CI fails below it. <!-- rule:nn.coverage -->
3. No new untyped public boundaries (the stack's lint rule names them). No new magic string logic without a typed constant. <!-- rule:nn.typed -->
4. No dead code, no commented-out blocks, no debug printing left in committed code (use the logger). <!-- rule:nn.clean -->
5. No secrets in the repo; add values only to `.env.example`, never `.env`. <!-- rule:nn.secrets -->
