# YAFT Agent Working Agreement

YAFT handles private financial records. Every agent must keep real statements, extracted text, rendered pages, passwords, account identifiers, and broker exports out of Git, build contexts, logs, fixtures, screenshots, and final messages.

## Non-negotiable worktree isolation

- The primary checkout at `/Users/yaft/Code/YAFT` is coordination-only for agents and subagents. They may inspect it, but must not edit project files, install dependencies, run code generators, format files, create commits, or run commands that write build or test artefacts there.
- Every implementation, integration, review fix, or experiment must run in its own Git worktree on its own branch. This includes the integrator. Two active agents must never share a worktree or branch.
- Put worktrees in the sibling directory `/Users/yaft/Code/YAFT-worktrees/<task-slug>`, never inside the repository and never in `YAFT-private-inputs`.
- Branch names use `agent/<task-slug>` for workers and `integrator/<initiative-slug>` for integration. A reused agent gets a new worktree and branch for each unrelated task.
- Every agent work session that changes tracked files must end with the retained changes committed on its assigned branch and a clean worktree. An agent must not leave completed or partial retained work uncommitted for another agent.
- Successful work gets a normal task commit. If an agent is blocked but has safe, useful partial work to retain, it must create a clearly labelled `wip:` commit and state that the commit is not integration-ready. If no change should be retained, restore only the files in the agent's write set and report that there is no commit; never create an empty or knowingly broken commit merely to satisfy this rule.
- Create a worktree from an explicit, committed base revision. Uncommitted changes in another checkout are not part of the base and must never be copied into the new worktree.
- If an agent starts in the primary checkout, on `main`, in another agent's worktree, or with unexpected pre-existing changes, it must stop before editing and report the mismatch to the coordinator.

The coordinator creates worktrees before starting agents. For example:

```sh
git -C /Users/yaft/Code/YAFT worktree add \
  /Users/yaft/Code/YAFT-worktrees/<task-slug> \
  -b agent/<task-slug> <base-commit>
```

Before changing files, every agent must verify and report:

```sh
git rev-parse --show-toplevel
git branch --show-current
git status --short
git rev-parse HEAD
```

The reported root, branch, cleanliness, and base commit must match the assignment.

## Task contract and coordination

- Each assignment must name: task slug, objective, base commit, worktree path, branch, allowed files or directories, acceptance criteria, required tests, and known dependencies on other tasks.
- An agent may read any repository file needed for context, but may modify only its declared write set. Generated files, snapshots, lockfiles, migrations, configuration, and documentation count as modifications and must be explicitly owned.
- The coordinator must assign a single owner for every shared file. High-conflict surfaces—including Prisma schema and migrations, parser contracts and routing, API DTOs, dependency manifests and lockfiles, shared UI components, and global styles—must not be edited concurrently.
- If a required change falls outside the write set, the agent must report the exact change needed and wait for the coordinator to reassign ownership. It must not make a temporary out-of-scope edit just to compile or pass tests.
- Agents must communicate contracts or interface changes early. Downstream agents continue against the pinned base until the coordinator supplies a new commit; they must not reach into another active worktree.
- Do not use another agent's uncommitted files. Cross-agent handoffs happen through a reviewed commit hash, not copying files, patches from dirty trees, stashes, or shared build output.
- Rebase, merge, cherry-pick, or dependency-base changes require coordinator approval. When the base changes, rerun the task's required verification.

Use this minimum assignment format when starting an agent or subagent:

```text
Task: <task-slug>
Objective: <one bounded outcome>
Base commit: <full commit SHA>
Worktree: /Users/yaft/Code/YAFT-worktrees/<task-slug>
Branch: agent/<task-slug>
Write set: <exact files/directories>
Acceptance: <observable completion conditions>
Verification: <commands/checks to run>
Dependencies: <task/commit dependencies or none>
```

## Repository boundaries

- Real input files live only in `/Users/yaft/Code/YAFT-private-inputs`.
- Temporary parsing artefacts live outside the repository and must be removed after use.
- Never commit `.env`, `samples/`, `tmp/`, `work/`, `uploads/`, PDFs, spreadsheets, extracted text, or rendered statement pages.
- Never add a Git remote unless the owner explicitly requests one.
- Use synthetic, anonymised fixtures in committed tests.

## Agent ownership

- `agent/axis-parser` may edit only `apps/api/src/imports/axis-pdf-parser.ts` and `apps/api/src/imports/axis-pdf-parser.spec.ts`.
- `agent/sbi-parser` may edit only `apps/api/src/imports/sbi-pdf-parser.ts` and `apps/api/src/imports/sbi-pdf-parser.spec.ts`.
- The integrator owns every shared file: parser contracts and routing, PNB compatibility, Prisma schema and migrations, encryption, API, UI, documentation, dependency files, and integration tests.
- Parser agents must not modify shared files to make their code compile. Report a required contract change to the integrator.

## Parser requirements

- Fail closed when the layout is unknown, ambiguous, malformed, or unreconciled.
- Never guess a password, institution, missing amount, or transaction identity.
- Validate the running balance and printed statement totals before returning rows.
- Return signed integer minor units; debits are negative and credits are positive.
- Preserve legitimate reversals and repeated transactions through bank-specific dedupe identities.
- Do not emit partial rows when validation fails.

## Credentials and logging

- Statement passwords are document-opening credentials only. Never accept or store banking passwords, PINs, OTPs, or CVVs.
- Never hardcode, print, log, snapshot, place in a URL, or commit a real password or encryption key.
- The PDF password may exist only in request memory or encrypted storage.
- Do not return ciphertext, IVs, authentication tags, keys, or plaintext credentials through an API.

## Verification and commits

- Each parser branch must include synthetic tests for its supported layout and its rejection paths.
- Private smoke tests may read the owner's sample from `/Users/yaft/Code/YAFT-private-inputs`, but must never copy it into a worktree.
- Before committing, run the assigned tests plus `git diff --check`, inspect `git status --short`, and verify every changed path is in the task's write set.
- Stage explicit paths; never use broad staging as a substitute for reviewing the change. Review `git diff --cached --stat` and `git diff --cached` before every commit.
- Creating the branch commit is part of the task, not an optional follow-up. An agent that changed tracked files must not send its final handoff until it has committed the retained changes and verified that `git status --short` is empty.
- Commits must be cohesive and contain only files owned by that agent. Use a message that identifies the task outcome, not the agent that produced it.
- Run the relevant tests before handoff and report the command result. For a private smoke test, report only pass/fail and the row count; do not expose transaction details, filenames, account data, or extracted text.
- Handoff must include: branch name, commit hash, changed paths, verification performed and results, assumptions, known limitations, and any requested follow-up. Never include secrets or private financial content.
- If an agent made no tracked change, it must report `no commit: no tracked changes` instead of creating an empty commit.
- Worker agents commit only to their assigned `agent/<task-slug>` branch. Integrators commit only to their assigned `integrator/<initiative-slug>` branch. No agent commits or merges directly to `main` unless the owner explicitly assigns final integration as that agent's task.
- Agents do not push, open pull requests, merge to `main`, or delete worktrees/branches unless the owner explicitly assigns that action.

## Integration and cleanup

- The integrator works in a dedicated clean worktree and is the only agent allowed to combine worker commits. Worker agents must not merge each other.
- Integrate reviewed commits one at a time in dependency order. After each integration, run the checks for that component; after all integrations, run the repository-level verification appropriate to the combined change.
- The integrator must commit the verified combined result on its integration branch before handoff. A dirty integrator worktree is not a valid delivery.
- Resolve conflicts by consulting the owning agent's contract and intent. Do not silently discard either side, weaken validation, or broaden scope to make a conflict disappear.
- Before proposing `main` integration, inspect the complete diff from the pinned base, confirm migration order and lockfile consistency where applicable, and verify that no private artefacts or credentials are present.
- Only the coordinator removes a worktree after its commit is integrated or explicitly abandoned and the worktree is clean. Never force-remove a worktree with uncommitted changes.
- Prune branches and worktrees only after confirming no active task or follow-up depends on them. Worktree cleanup is not permission to delete private inputs or unrelated temporary data.

## Git and operational safety

- Never run destructive or history-rewriting commands—including `git reset --hard`, `git clean`, forced checkout, forced branch deletion, or force-push—on shared or agent-owned work without explicit owner approval.
- Never stash changes as a coordination mechanism. A stash is local, easy to misattribute, and not an acceptable handoff.
- Do not modify another agent's branch, worktree, commit, test output, dependency directory, or running process.
- Prefer deterministic, task-scoped commands. Do not run repository-wide formatters, generators, migrations, or dependency upgrades unless the task contract explicitly owns all resulting files.
- If tests require shared ports or services, assign unique ports and isolated databases or schemas per worktree. Never point automated tests at production or at a database containing real financial data.
- Review comments and bug reports should name reproducible behavior, affected paths, and severity without including private statement content.
