---
name: mote-guidelines
description: Behavioral guidelines for coding in the mote project (ECS game engine + Preact editor). Automatically applies to all coding, reviewing, and refactoring tasks in this codebase.
license: MIT
---

# Mote Coding Guidelines

Behavioral guidelines to reduce common mistakes when working on the mote game engine and editor. Derived from Andrej Karpathy's observations on LLM coding pitfalls, tailored for this specific codebase.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## Confusion Protocol

When you encounter high-stakes ambiguity during coding:
- Two plausible architectures or data models for the same requirement
- A request that contradicts existing patterns and you're unsure which to follow
- A destructive operation where the scope is unclear
- Missing context that would change your approach significantly

**STOP.** Name the ambiguity in one sentence. Present 2-3 options with tradeoffs. Ask the user. Do not guess on architectural or data model decisions.

This does NOT apply to routine coding, small features, or obvious changes.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- **State your assumptions explicitly.** If uncertain, ask.
- **If multiple interpretations exist, present them — don't pick silently.**
- **Check existing patterns first.** Look at how similar features are already implemented in the codebase before inventing new conventions.
- **If something is unclear, stop.** Name what's confusing. Ask.

### Mote-Specific

- **ECS first:** Before adding state, ask "Should this be a Component?" Don't put mutable state directly on systems or managers.
- **Renderer first:** Before touching graphics, confirm whether the feature needs WebGPU (new shader) or can be done with existing rendering pipeline. Don't add WebGL2-specific code when WebGPU path exists.
- **Editor context:** Before adding UI state, check if it should live in a Signal (`@preact/signals`) or if it's ephemeral local state.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- **If you write 200 lines and it could be 50, rewrite it.**

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### Mote-Specific

- **Component constructors must be parameterless.** Don't add convenience constructors with arguments. This is enforced by the ECS registry.
- **Don't create helper classes/managers unless multiple systems need them.** A single system can inline its logic.
- **Avoid premature plugin abstraction.** If a feature is only used in one place, don't make it a Plugin yet.
- **Shaders:** Start with the simplest WGSL that works. Don't add uniform buffers or bind groups that aren't strictly necessary.

---

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- **Match existing style, even if you'd do it differently.**
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that **YOUR** changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

### Mote-Specific

- **Preserve undo/redo compatibility.** If you modify editor commands, ensure the command pattern (execute/undo/redo) still works.
- **Don't change existing Component shapes unless absolutely necessary.** Adding/removing fields breaks saved scenes and serialization.
- **If modifying a System, check `world.query()` patterns in similar systems first.** Don't invent new query conventions.

---

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### Mote-Specific

- **Graphics changes:** Success criteria must include visual verification. "The sprite renders correctly" is weak. "The sprite renders at the correct position with nearest filtering, and the pixel art is not blurred" is strong.
- **Editor changes:** Success criteria must include interaction verification. "The panel shows data" is weak. "Clicking an entity in the hierarchy selects it, and the inspector updates within 1 frame" is strong.
- **Performance claims:** If you optimize, measure. "Faster" is not a success criterion. "Reduces draw calls from N to M" is.

---

## 5. Hard Constraints (Never Violate)

These are project-level invariants. Violating them creates immediate bugs.

| Constraint | Consequence of Violation |
|---|---|
| Component `new()` must be parameterless | ECS `ComponentRegistry` fails to instantiate |
| WebGPU + WGSL only for rendering | WebGL2 fallback is auto-generated; Canvas 2D fallback is out of scope |
| Editor uses Preact + `@preact/signals` only | React/Vue imports break the build |
| Undo/Redo must be pure command objects | State desync, broken undo history |
| `dt` capped at 200ms in `GameLoop` | Tab-switch death spiral |
| Texture filtering is `nearest` | Pixel art becomes blurry |
| Coordinate system: top-left origin, Y down | All position math is wrong |

---

## 6. When to Pause and Ask

Stop and ask the user before proceeding if:

- The task requires adding a new top-level module or package.
- The task contradicts an existing pattern and a refactor seems necessary.
- You need to modify a file marked as "orphan" or "deprecated" in AGENTS.md.
- The task involves serialization format changes (will break saved projects).
- You find yourself writing more than 150 lines for what seems like a simple feature.
