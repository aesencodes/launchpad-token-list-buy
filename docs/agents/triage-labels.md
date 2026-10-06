# Triage Labels

The skills speak in terms of five canonical triage roles. **This repository does not use them
today**: `gh label list` shows only GitHub's defaults (including `wontfix`) plus the `wayfinder:*`
labels this board actually sorts work with. So the table below is the vocabulary to reach for *if
triage is ever run*, not a description of labels that exist here — `gh issue edit --add-label
needs-triage` fails until that label is created.

| Role (skills vocabulary) | Label string to use | Meaning                                  |
| ------------------------ | ------------------- | ---------------------------------------- |
| needs triage             | `needs-triage`      | Maintainer needs to evaluate this issue  |
| needs info               | `needs-info`        | Waiting on reporter for more information |
| ready for agent          | `ready-for-agent`   | Fully specified, ready for an AFK agent  |
| ready for human          | `ready-for-human`   | Requires human implementation            |
| will not fix             | `wontfix`           | Will not be actioned (already exists)    |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label
string from the table — creating the label first if it does not exist yet.

The labels this board does use are the `wayfinder:*` set defined in
[`issue-tracker.md`](issue-tracker.md): `wayfinder:map`, `wayfinder:research`,
`wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`.
