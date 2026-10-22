---
name: agent-hierarchy
description: Use when a task is big, ambiguous or high-stakes enough to delegate to subagents - how to staff an Opus / Sonnet / Haiku / Sonnet "company" sized to the task, run healthy and visible competition between peers, judge by evidence, integrate safely and report a scoreboard.
---

# Agent Hierarchy

Run delegated work like a small company: an Opus director, Sonnet managers who compete, Haiku clerks who gather facts cheaply, and a Sonnet audit desk that checks the winner. Staff only the tiers the task needs. The goal is better work through healthy, visible competition: same brief, rubric known up front, judged on evidence, losers' good ideas kept.

## The four tiers
| Tier | Model | Job | Never |
|---|---|---|---|
| 1 Director | Opus (the lead session) | Frames the task, writes briefs and the rubric, picks the staffing, judges, integrates, owns the push and the report | Hands judging to a contestant; pushes unverified work |
| 2 Managers | Sonnet, 2-4 in parallel | Compete on one brief: propose, implement or audit; must cite files, tests and screenshots | Read or merge a rival's work |
| 3 Clerks | Haiku, any number | Cheap fact work: inventories, grep sweeps, name checks, screenshot lists, log triage. One narrow question each, output to a file | Make design calls or edit product code |
| 4 Audit | Sonnet, a fresh agent | Reviews the chosen work cold: reruns the gate, hunts regressions, checks every claim against the code | Audit its own work; fix what it audits (it reports) |

## Size the company to the task
| Task | Staffing |
|---|---|
| Small and clear (one file, known fix) | Director alone, then verification-gate. No agents. |
| Clear but sizeable | 1 Sonnet implementer + 1 Sonnet audit |
| Needs a wide fact base first | Haiku clerks fan out, then the director or one Sonnet acts on the catalogue |
| Ambiguous, design-heavy or high value | 2-4 competing Sonnet managers on the same brief, director judges, Sonnet audit |
| Huge (many areas) | Split by area; each area gets the row above. Cap at ~8 live agents. |
Add a tier only when it changes the outcome; competition costs tokens, so use it where answers can differ in quality.

## Healthy competition rules
1. Same brief, same inputs, same deadline for every rival. Clerk catalogues are shared with all rivals.
2. Publish the rubric in the brief before work starts (e.g. evidence 40, player impact 30, scope discipline 20, clarity 10). No hidden criteria.
3. Isolation: each implementer gets `isolation: "worktree"`; rivals never see each other's output until judging.
4. Judge on evidence only: a claim without a file:line, a test or a screenshot scores zero. Verify the top claims yourself (or with a clerk) before trusting them.
5. Merge the best parts, not just the winner: credit every idea you keep, by agent.
6. Penalise gaming: padding, invented issues, scope creep, breaking tests, or arguing about rivals all lose points.
7. Healthy means no sabotage incentives: agents are scored on their own work, never on a rival's failures.

## Make it visible
- Give each agent a short public name (e.g. `audit-A`, `fix-B`).
- Report a scoreboard to the user after each round: agent, model, score per rubric line, what was kept.
- Keep briefs, catalogues and scoreboards in the scratchpad so a later round can reuse them.

## Brief template
Goal (one line) / Context and skills to read / Inputs (clerk files) / Output (exact file path and format) / Rubric / Rules (no rival access, no push, no PRs, stay in scope, cite evidence) / Effort and stop condition.

## Safety and integration (director only)
- Only the director commits to the shared branch and pushes. Agents commit inside their worktree.
- Integrate with `git cherry-pick` of the chosen commits; never ask an agent to merge or read untrusted rival work, and never do a denied action on an agent's behalf.
- Kill only the specific PIDs your own agents started; never `pkill`/`killall`.
- Set `effort` on agents only when the user asks for an effort level.
- Every round ends with the audit tier and skills/verification-gate before the push.

## Gotchas
- Too many rivals on a small task is noise; two good ones beat four rushed ones.
- Haiku is for facts, not judgement; recheck any Haiku finding that would drive a code change.
- Agent reports are not shown to the user; the director must relay the scoreboard and decisions.
- Rivals that share a worktree will overwrite each other; always isolate implementers.

## Verify
- The scoreboard names every agent and every kept idea.
- The audit agent reran the gate on the integrated head.
- skills/verification-gate passes before the push.
