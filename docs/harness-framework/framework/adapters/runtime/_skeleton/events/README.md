# Recorded event samples

Put here one JSON file per event that the runtime sends to its hooks, recorded in a real session of the runtime (not written by hand from its
documentation, or marked so as the Cursor ones are). `conformance.json` names six of them:

| Sample | The event |
| ------ | --------- |
| `sessionStart` | the start of a session |
| `shellRefused` | the shell tool about to run `git push origin <the production branch>` |
| `shellAllowed` | the shell tool about to run `ls -la` |
| `editRefused` | the file tool about to write an environment file (`.env`) |
| `editAllowed` | the file tool about to edit a source file |
| `editAfter` | the event after a file edit |

The framework's hooks read the events through `tools/runtime-hooks/io.mjs`. If the runtime's form is not one it knows, extend `io.mjs` in the framework
source, with a test, and offer the change upstream.
