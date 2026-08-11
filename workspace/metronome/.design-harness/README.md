# `.design-harness`

This directory is the canonical, Git-tracked design source for this example project.

- `project.json` identifies the project and active screen.
- `tokens.json` is the only design-token source of truth.
- `components.json` defines the component contracts ChatGPT may compose.
- `screens/*.json` stores one independent screen specification per file.

The browser workspace, CLI, future repo-harness adapter, and ChatGPT must all read and write these same files. Browser storage is never canonical.
