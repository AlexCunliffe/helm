# 08 · The knowledge boundary

Helm stores operational task state. A separate markdown vault stores durable knowledge. These stores are linked, not merged.

| | Helm | Knowledge vault |
| --- | --- | --- |
| Holds | Tasks, next actions, commitments, and completion records | Decisions, runbooks, people, vendors, and project context |
| Format | Structured Convex data | Portable documents with human-readable history |
| Writes | Authorized task operations and configured automation | Proposed for confirmation before writing |

The optional SessionEnd hook logs provisional completions to Helm. It never writes a vault note. When work yields a durable decision, the assistant can propose a note and wait for authorization.

`tasks.vaultRef` and `projects.vaultRef` hold optional relative references. `areas.vaultDomain` can identify the corresponding knowledge domain. These are linking fields, not a filesystem integration. The repository does not read, create, or synchronize a vault automatically.

Use conventions chosen by the vault owner. Keep references relative. Keep credentials in their original secret store. Cite operational systems rather than copying their private data into notes.

The evening reconcile may offer a dated journal entry. It must not append one silently. This boundary keeps a completion log from becoming an unreviewed knowledge store.
