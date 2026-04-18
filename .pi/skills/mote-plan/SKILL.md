---
name: mote-plan
description: Task breakdown and execution planning for mote project features. Trigger manually when the user says "plan", "拆解任务", "任务计划", "execution plan", "milestone", or "/skill:mote-plan". Use after a design is finalized to create actionable steps.
---

# Mote Plan

Task breakdown and execution planning for the mote game engine and editor. Use this skill after a design is finalized to convert architecture decisions into concrete, verifiable implementation steps.

---

## When to Use This Skill

- A design document or architecture decision is ready, and implementation needs to begin
- A large feature needs to be broken into incremental deliverables
- You need to establish milestones with clear success criteria
- Multiple files/modules need coordinated changes
- The user asks "怎么开始？" / "从哪下手？" / "plan this out"

---

## Confusion Protocol

When you encounter high-stakes ambiguity during planning or execution:
- Two plausible architectures or data models for the same requirement
- A request that contradicts existing patterns and you're unsure which to follow
- A destructive operation where the scope is unclear
- Missing context that would change your approach significantly

**STOP.** Name the ambiguity in one sentence. Present 2-3 options with tradeoffs. Ask the user. Do not guess on architectural or data model decisions.

This does NOT apply to routine coding, small features, or obvious changes.

---

## Planning Process

### Phase 1: Decomposition

Break the design into **atomic tasks**. An atomic task:

- Touches at most 2-3 files
- Can be described in one sentence
- Has a clear yes/no completion criterion
- Takes roughly 15-60 minutes of focused implementation

**If a task feels too big, split it.** If a task feels too small (5 minutes), batch it with a related task.

### Phase 2: Dependency Sorting

Order tasks by dependency:

1. **Foundation first:** Data structures, types, interfaces, constants
2. **Core logic next:** Systems, algorithms, business rules
3. **Integration last:** Wiring, event handlers, UI connections
4. **Polish final:** Styling, animations, edge cases, error messages

Use this notation:

```
Task A → Task B     (B depends on A)
Task C || Task D    (C and D are independent, can be parallel)
```

### Phase 3: Verification Definition

For every task, define **how you will know it's done**:

| Weak | Strong |
|---|---|
| "Implement the component" | "Create `Health.ts` with parameterless constructor, fields `current: number`, `max: number`, register in `ComponentRegistry`" |
| "Add the system" | "Create `HealthSystem.ts` that queries `Health` components and decrements `current` each frame, respects `dt` cap" |
| "Make the UI work" | "Inspector panel displays `Health.current` / `Health.max` as numeric inputs; modifying input updates component within 1 frame" |
| "Fix the bug" | "Reproduce: spawn 1000 entities → before: frame time > 16ms, after: frame time < 16ms" |

---

## Task Categories

### 🏗️ Foundation (Data & Types)

- Define interfaces, types, enums
- Create Component classes (parameterless constructor!)
- Add constants, config objects
- Update registries (ComponentRegistry, System registry, etc.)

**Verify:** TypeScript compiles without errors. New types are importable.

### ⚙️ Core (Logic & Systems)

- Implement System update loops
- Implement algorithms, utility functions
- Add engine plugin initialization

**Verify:** Unit test or manual test passes. System produces expected output for known input.

### 🔌 Integration (Wiring)

- Connect new system to game loop
- Hook editor UI to engine state
- Add event listeners / command bindings
- Update module exports / barrel files

**Verify:** End-to-end: perform the user action → observe the correct result.

### 🎨 UI/UX (Editor)

- Add Preact components
- Connect Signals to engine data
- Implement commands (execute/undo/redo)
- Add keyboard shortcuts

**Verify:** Visual check + interaction check + undo/redo check.

### 🧪 Test & Polish

- Add tests for edge cases
- Verify performance (frame time, memory)
- Check serialization round-trip
- Verify WebGL2 fallback works (if graphics)

---

## Output Format

When asked to plan something, produce:

```
## Overview
Total tasks: N
Estimated phases: N
Critical path: Task X → Task Y → Task Z

## Phase 1: Foundation
1. [Task name] → verify: [specific criterion]
2. [Task name] → verify: [specific criterion]

## Phase 2: Core Logic
3. [Task name] → verify: [specific criterion]
...

## Phase 3: Integration
...

## Phase 4: Polish
...

## Risk Areas
- [What could go wrong and how to mitigate]

## Open Questions
- [Anything that might block execution]
```

Then save the complete plan document to the project root `plans/` directory:

### File Naming

```
plan-{keywords}-{YYYYMMDD}.md
```

- `keywords`: 2-4 keywords describing the requirement, lowercase, hyphen-separated
- `YYYYMMDD`: current date

Examples:
- `plan-health-damage-system-20260418.md`
- `plan-particle-renderer-webgpu-20260418.md`
- `plan-sprite-editor-blender-layout-20260418.md`

If the user hasn't provided a clear keyword summary, derive one from the requirement or ask for confirmation before saving.

### Save Location

Project root: `plans/` (create the directory if it doesn't exist)

---

## Execution Guidelines

### During Implementation

- **Implement one phase at a time.** Don't start Phase 2 until Phase 1 is verified.
- **If a task reveals a design flaw, pause.** Don't patch around it. Flag it, propose a design adjustment, get confirmation.
- **Commit after each phase.** (If using version control.)
- **If a verification fails, debug before proceeding.** Don't "come back to it later."

### Handling Blockers

If you hit an unexpected blocker:

1. State the blocker in one sentence
2. List 2-3 possible resolutions with tradeoffs
3. Ask the user which to pursue
4. Do not proceed until resolved

### Scope Creep Defense

If mid-implementation you discover "while I'm here, I should also...":

- Write it down as a follow-up task
- Do NOT implement it in the current task
- Present it to the user after the current plan is complete

---

## Example

**Design:** Add a "Health" component and a damage system to the engine, with editor support.

**Plan:**

```
## Overview
Total tasks: 7
Estimated phases: 4
Critical path: Define Component → Register Component → HealthSystem → Inspector Panel

## Phase 1: Foundation
1. Create `Health.ts` component with `current`, `max` fields → verify: compiles, constructor has zero params
2. Register `Health` in `ComponentRegistry` → verify: `world.add(entity, new Health())` works

## Phase 2: Core Logic
3. Create `HealthSystem.ts` that decrements `current` when `Damage` event fired → verify: spawn entity with Health=10, apply Damage=3, Health=7
4. Create `Damage` event type → verify: event can be emitted and consumed

## Phase 3: Integration
5. Add `HealthSystem` to engine system list → verify: system runs each frame
6. Add Health inspector panel in editor → verify: selecting entity shows current/max, editable

## Phase 4: Polish
7. Add undo/redo for health edits → verify: modify health → undo → redo, values correct

## Risk Areas
- Damage event delivery: if event system doesn't exist, need to create it first (new foundation task)
- Inspector panel may need numeric input component; check if one exists in shared-ui
```
