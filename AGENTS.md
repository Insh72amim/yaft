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

- Each assignment must name: task slug, objective, business reason, base commit, worktree path, branch, allowed files or directories, acceptance criteria, verification tier and commands, known dependencies on other tasks, and explicit non-goals.
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
Reason: <why this change is needed>
Base commit: <full commit SHA>
Worktree: /Users/yaft/Code/YAFT-worktrees/<task-slug>
Branch: agent/<task-slug>
Write set: <exact files/directories>
Current behavior: <observable behavior or unknown>
Expected behavior: <observable behavior>
Relevant context: <files, symbols, contracts, and settled decisions>
Non-goals: <explicit exclusions>
Acceptance: <observable completion conditions>
Verification tier: <targeted|package|integration|high-risk>
Verification: <canonical commands/checks to run>
Dependencies: <task/commit dependencies or none>
Known failures: <pre-existing failures at the base commit or none>
Decision authority: <decisions allowed and decisions requiring approval>
```

## Context readiness and preflight

- No implementation starts until the coordinator provides a context packet containing every assignment field above. Missing information must be marked `unknown`; silence does not mean a decision has been made.
- Use exact paths, symbol names, route names, model names, and commit hashes instead of pasting large files or broad repository summaries.
- The context packet must identify applicable architecture, data, security, and privacy invariants so the agent does not have to rediscover them.
- If information essential to the contract or write set is unknown, perform a bounded read-only discovery task before assigning implementation. The discovery handoff must identify relevant files, behavior, risks, and a recommended implementation boundary.
- Before editing, the agent reports one compact preflight containing: verified worktree, branch, base commit, cleanliness, understood outcome, expected changed paths, planned verification, assumptions, and blockers.
- Read the task packet, applicable `AGENTS.md` files, and directly relevant code before scanning wider areas. Prefer targeted searches by path or symbol; do not repeatedly inventory the entire repository.
- Do not reopen a settled decision unless new repository evidence shows that it is unsafe, inconsistent, or impossible to implement.

## Task sizing and dependency planning

- Each worker task produces one independently reviewable outcome with one clear definition of done.
- The coordinator maintains dependency order for concurrent tasks and identifies which tasks may run in parallel.
- Shared contracts, schemas, DTOs, and interfaces must be owned, completed, and committed before dependent implementation begins. Dependent agents receive the exact prerequisite commit hash.
- Tasks that modify the same high-conflict file are serialized. Apparent speed from concurrent editing does not justify predictable merge conflicts.
- Separate exploration from implementation when the affected area, behavior, or required contract is not yet understood.
- Partition broad initiatives by stable package, feature, or exact file ownership. Do not give multiple agents overlapping repository-wide objectives.

## Repository boundaries

- Real input files live only in `/Users/yaft/Code/YAFT-private-inputs`.
- Temporary parsing artefacts live outside the repository and must be removed after use.
- Never commit `.env`, `samples/`, `tmp/`, `work/`, `uploads/`, PDFs, spreadsheets, extracted text, or rendered statement pages.
- Never add a Git remote unless the owner explicitly requests one.
- Use synthetic, anonymised fixtures in committed tests.

## Repository context structure

- Maintain small scoped `AGENTS.md` files for areas with recurring tasks or special invariants, such as API, web, imports, Prisma, authentication, and encryption.
- Scoped instructions document only local architecture, commands, invariants, and ownership boundaries. They must not duplicate or weaken repository-wide rules.
- When a change makes existing context inaccurate, updating the relevant scoped guidance is part of that task's definition of done and must be included in its write set.
- Context documentation must describe stable contracts and commands, not temporary implementation notes or private data.

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

## Canonical commands and isolated environments

- The repository must document canonical commands for initial setup, targeted API tests, targeted web tests, linting, type checking, database validation or generation, and full integration verification.
- The coordinator includes only the commands relevant to the assignment. Agents use those commands rather than inventing competing workflows unless they report why a documented command is unsuitable.
- Dependency directories and generated build output remain isolated per worktree. Never share mutable `node_modules`, generated clients, coverage output, or build directories between active worktrees.
- A package-manager download cache may be shared outside the repository, but runtime output, databases, extracted content, and private inputs must never be placed in it.
- Concurrent services use unique ports and isolated synthetic databases or schemas. Setup instructions must never require copying `.env` files or secrets into a worktree.

## Verification tiers

- Every task receives exactly one minimum verification tier:
  - `targeted`: the changed unit and its nearest tests;
  - `package`: the affected application or package tests plus its type and lint checks;
  - `integration`: cross-package behavior and affected integration tests;
  - `high-risk`: finance, authentication, encryption, imports, migrations, or private-data boundaries, including focused rejection and failure-path tests.
- During implementation, run the smallest relevant feedback loop. Before committing, run the complete assigned tier.
- Only the integrator runs the full repository suite unless a worker's task contract explicitly requires it.
- Pre-existing failures are recorded against the base commit and are not silently attributed to the current task. Agents must not fix unrelated failures without an expanded write set.

## Decision and blocker protocol

- Agents may make reversible implementation decisions inside their write set when public behavior, shared contracts, security boundaries, and financial correctness remain unchanged.
- Changes to schemas, migrations, APIs, shared DTOs, security controls, financial calculations, dependencies, or shared contracts require explicit ownership and must be announced to dependent agents.
- Non-blocking uncertainty uses the safest reversible assumption and is recorded at handoff. Security, privacy, financial-correctness, destructive-operation, or public-contract uncertainty is escalated before implementation.
- After two failures with the same cause, do not repeat the same action unchanged. Record the evidence, investigate a bounded alternative, or report a blocker.
- A blocker report includes the attempted action, concise observed behavior, likely cause, affected acceptance criterion, and safest next action.
- Continue independent in-scope work while waiting when doing so cannot cause divergence or weaken validation.

## Communication efficiency

- Provide updates at preflight, when a contract or assumption changes, when a material blocker appears, and at handoff. Do not narrate every search or routine command.
- Each update must add decision-relevant information. Summarize errors and results; do not paste large logs unless the exact text is needed to diagnose a blocker.
- Ask one concrete question at a time and include the evidence and consequence needed for the coordinator to answer quickly.
- Do not ask for information already present in the task packet, applicable instructions, or a prerequisite handoff.

## Verification and commits

- Each parser branch must include synthetic tests for its supported layout and its rejection paths.
- Private smoke tests may read the owner's sample from `/Users/yaft/Code/YAFT-private-inputs`, but must never copy it into a worktree.
- Before committing, run the assigned tests plus `git diff --check`, inspect `git status --short`, and verify every changed path is in the task's write set.
- Stage explicit paths; never use broad staging as a substitute for reviewing the change. Review `git diff --cached --stat` and `git diff --cached` before every commit.
- Creating the branch commit is part of the task, not an optional follow-up. An agent that changed tracked files must not send its final handoff until it has committed the retained changes and verified that `git status --short` is empty.
- Commits must be cohesive and contain only files owned by that agent. Use a message that identifies the task outcome, not the agent that produced it.
- Run the relevant tests before handoff and report the command result. For a private smoke test, report only pass/fail and the row count; do not expose transaction details, filenames, account data, or extracted text.
- Handoff must include: completion status, branch name, commit hash, changed paths, important symbols or contracts changed, verification commands and results, assumptions, known limitations, dependency information, requested follow-up, and whether the commit is integration-ready. Never include secrets or private financial content.
- A downstream agent uses the committed diff and structured handoff instead of another agent's chat transcript, dirty worktree, or raw command history.
- If an agent made no tracked change, it reports `no commit: no tracked changes` instead of creating an empty commit.
- Worker agents commit only to their assigned `agent/<task-slug>` branch. Integrators commit only to their assigned `integrator/<initiative-slug>` branch. No agent commits or merges directly to `main` unless the owner explicitly assigns final integration as that agent's task.
- Agents do not push, open pull requests, merge to `main`, or delete branches unless the owner explicitly assigns that action.

## Integration and cleanup

- The integrator works in a dedicated clean worktree and is the only agent allowed to combine worker commits. Worker agents must not merge each other.
- Integrate reviewed commits one at a time in dependency order. After each integration, run the checks for that component; after all integrations, run the repository-level verification appropriate to the combined change.
- The integrator must commit the verified combined result on its integration branch before handoff. A dirty integrator worktree is not a valid delivery.
- Resolve conflicts by consulting the owning agent's contract and intent. Do not silently discard either side, weaken validation, or broaden scope to make a conflict disappear.
- Before proposing `main` integration, inspect the complete diff from the pinned base, confirm migration order and lockfile consistency where applicable, and verify that no private artefacts or credentials are present.
- A worktree is done only after all retained changes are committed, `git status --short` is empty, the branch and handoff commit hash are recorded, and no agent, command, server, or test process is using the directory.
- The coordinator removes every done worktree immediately after handoff, even when its branch is still waiting for integration. Worktree removal must not be deferred as routine housekeeping.
- Remove a done worktree with `git worktree remove <absolute-worktree-path>` from a different checkout. Never use `--force`. If removal reports changes or active use, the task is not done; stop and resolve the condition instead of deleting the directory manually.
- Removing a worktree does not remove its branch or commits. Retain the branch until its handoff commit is integrated or explicitly abandoned; branch deletion is a separate coordinator action.
- An integrator worktree follows the same rule and is removed after its committed integration handoff. A later integration or review request gets a newly created worktree from the retained branch or commit.
- Prune stale worktree metadata only after confirming no active task or process depends on it. Worktree cleanup is not permission to delete private inputs, another agent's directory, branches, or unrelated temporary data.

## Git and operational safety

- Never run destructive or history-rewriting commands—including `git reset --hard`, `git clean`, forced checkout, forced branch deletion, or force-push—on shared or agent-owned work without explicit owner approval.
- Never stash changes as a coordination mechanism. A stash is local, easy to misattribute, and not an acceptable handoff.
- Do not modify another agent's branch, worktree, commit, test output, dependency directory, or running process.
- Prefer deterministic, task-scoped commands. Do not run repository-wide formatters, generators, migrations, or dependency upgrades unless the task contract explicitly owns all resulting files.
- If tests require shared ports or services, assign unique ports and isolated databases or schemas per worktree. Never point automated tests at production or at a database containing real financial data.
- Review comments and bug reports should name reproducible behavior, affected paths, and severity without including private statement content.
