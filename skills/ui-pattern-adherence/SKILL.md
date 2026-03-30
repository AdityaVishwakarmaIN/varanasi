---
name: ui-pattern-adherence
description: Enforce close adherence to existing UI, interaction, and layout patterns already present in the codebase. Use when the user wants something to match an existing dialog, button, footer, spacing pattern, theme, placement, or component behavior; when the user points to a screenshot or exact spot; or when "similar to X" must mean "verify X in code first, then implement."
---

# UI Pattern Adherence

Treat nearby production code as the source of truth. Do not infer colors, spacing, typography, copy density, or alignment when a matching pattern already exists in the repo.

## Workflow

1. Restate the request in concrete terms.
   Example: "Place the trigger in the footer's bottom-right cell and match the existing exit dialog styling."

2. Find the real reference implementation in code before editing.
   Use `rg` to locate the closest matching component, dialog, button, layout block, or theme class.
   Prefer exact in-product patterns over general design taste.

3. Copy the pattern, then change only the minimum necessary behavior.
   Reuse the same primitives, variants, class structure, and wording style where possible.
   Avoid introducing custom colors, special emphasis, extra warning blocks, or new layout patterns unless the user explicitly asks for them.

4. Verify placement against the actual container structure.
   If the user specifies a location such as "bottom right" or points to a screenshot, inspect the parent layout and map the request to the correct grid/flex cell before styling the child.

5. Keep copy proportional to the reference.
   If the existing dialog is short and utilitarian, keep the new one short and utilitarian.
   If the existing secondary actions use muted text links, do not replace them with badge-like or button-heavy treatments.

6. Preserve behavior parity.
   When cloning an existing interaction pattern, confirm that open/close behavior, action ordering, and mobile/desktop layout follow the same structure unless the user asks otherwise.

## Guardrails

- Do not guess a theme when a matching theme exists in code.
- Do not answer "similar" requests from memory alone; inspect the reference component first.
- Do not optimize for novelty when the user is asking for consistency.
- Do not add explanatory UI copy beyond what the reference pattern supports.
- Do not treat vague placement as solved until the resulting DOM structure matches the requested corner/row/column.

## Interpretation Rules

- If the user says "like this one", inspect that exact implementation.
- If the user highlights a specific spot in a screenshot, solve for placement first and styling second.
- If the user complains about look-and-feel, prefer direct class-level alignment with the existing pattern over redesign.
- If the user asks for a "precise edit", keep the diff narrow and avoid opportunistic cleanup.

## Pre-Reply Checks

Before finalizing, confirm:

- The chosen reference component was actually inspected in code.
- Colors and button variants come from existing classes or primitives, not fresh guesses.
- The new UI element sits in the intended layout position on both desktop and mobile paths when both exist.
- The wording and visual weight match nearby UI.
