# Recorded event samples

The events that the runtime hooks receive, one file each. The Claude Code samples have the shape that Claude Code sends to a `PreToolUse`, `PostToolUse` or
`SessionStart` hook. The Cursor samples are written from Cursor's hook documentation (design §9), not recorded in a live Cursor session: the field names of
`tool_input` for `Write` are on the owner's checklist for the Cursor proof (task 1.5 of the framework's own plan). `compat-bash-push-main.json` is the Claude
Code form with Cursor's `cursor_version`, which Cursor sends when it runs the Claude Code hooks (compat mode).
