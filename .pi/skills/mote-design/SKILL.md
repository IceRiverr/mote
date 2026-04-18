---
name: mote-design
description: Software architecture and API design guidelines for the mote game engine and editor. Trigger manually when the user says "design", "architecture", "API design", "data structure design", "module design", or "/skill:mote-design".
---

# Mote Design

Structured design guidelines for the mote game engine (ECS + WebGPU/WebGL2) and Preact editor. Use this skill when architecting new features, APIs, data structures, or module boundaries.

---

## When to Use This Skill

- Designing a new engine system, component, or renderer feature
- Designing a new editor panel, tool, or workflow
- Refactoring module boundaries or public APIs
- Creating new data structures that cross system boundaries
- Adding a new Plugin to the engine

---

## Confusion Protocol

When you encounter high-stakes ambiguity during design:
- Two plausible architectures or data models for the same requirement
- A request that contradicts existing patterns and you're unsure which to follow
- A destructive operation where the scope is unclear
- Missing context that would change your approach significantly

**STOP.** Name the ambiguity in one sentence. Present 2-3 options with tradeoffs. Ask the user. Do not guess on architectural or data model decisions.

This does NOT apply to routine coding, small features, or obvious changes.

---

## Design Process

### Phase 1: Constraint Gathering (MUST do first)

Before any design decisions, answer these questions explicitly:

1. **Lifecycle:** Is this short-lived (per-frame) or long-lived (session-scoped)?
2. **Ownership:** Which system/module owns the data? Which owns the behavior?
3. **Mutation pattern:** Read-heavy? Write-heavy? Who writes, who reads?
4. **Cross-boundary:** Does data flow engine → editor, editor → engine, or stay within one boundary?
5. **Serialization:** Must this survive save/load? If yes, is it part of Scene format or Editor state?
6. **Existing patterns:** Find the 2 most similar existing features. How do they solve this?

If any answer is "I'm not sure," stop. State the uncertainty. Ask the user.

### Phase 2: Architecture Decision

For each major decision, document:

```
Decision: <what you decided>
Alternatives considered: <list 1-2 alternatives>
Rationale: <why this choice over alternatives>
Tradeoff accepted: <what you give up>
```

---

## ECS Design Rules

### Components

- **Components are pure data.** No methods beyond trivial getters/setters. No business logic.
- **Constructor must be `new()` (no parameters).** All initialization happens via field assignment after construction or via a factory function outside the class.
- **Prefer flat, scalar fields over nested objects.** ECS queries work best on flat structures.
- **Use `Entity` references (numbers) instead of object references.** Prevents memory leaks and serialization issues.

```typescript
// ✅ Good
class Transform extends Component {
  x = 0;
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
}

// ❌ Bad
class Transform extends Component {
  constructor(x: number, y: number) {} // parameterless required
  position: Vec2 = new Vec2();         // nested object, harder to query
  parent: Transform | null = null;     // object reference, use parentId: number instead
}
```

### Systems

- **One concern per System.** A System should do one thing and do it well.
- **Systems read via `world.query()`, mutate via `world.add()`/`world.remove()`/`world.set()`.**
- **Never cache query results across frames unless you have a performance reason.** Re-query each frame or use change detection.
- **System order matters.** If your System depends on another System's output, document the dependency explicitly.

### Queries

- **Prefer specific component combinations over broad queries.** `world.query(Transform, Sprite)` is better than querying all entities and filtering manually.
- **If you need "entities without X",** use query exclusion or a dedicated tag component.

---

## API Design Rules

### Public APIs (cross-module or user-facing)

- **Start minimal.** Public APIs are contracts you can't break lightly. Add, don't remove.
- **Use options objects for >2 parameters.**

```typescript
// ✅ Good
interface CreateSpriteOptions {
  texture: string;
  x?: number;
  y?: number;
  layer?: number;
}
function createSprite(world: World, options: CreateSpriteOptions): Entity {}

// ❌ Bad
function createSprite(world: World, texture: string, x: number, y: number, layer: number): Entity {}
```

- **Return values should be unambiguous.** Prefer `Entity` (number) or `Result<T, E>` over booleans that require side-effect inspection.
- **Async APIs must be clearly marked.** If an operation is async, the function name or return type should make this obvious.

### Internal APIs (within a module)

- **Private by default.** Export only what other modules need.
- **Co-locate related functions.** If two functions always change together, keep them in the same file.

---

## Data Structure Design

### For Engine Data (Runtime)

- **Prefer SoA (Structure of Arrays) over AoS (Array of Structures) when iterating over many items.** ECS is already SoA-friendly.
- **Use typed arrays (`Float32Array`, `Uint32Array`) for GPU-bound data.**
- **Pool frequently allocated objects** (vectors, matrices, temporary arrays) to reduce GC pressure.

### For Editor Data (UI State)

- **Use `@preact/signals` for reactive UI state.**
- **Separate editor state from engine state.** The editor operates on the engine world but maintains its own selection, undo stack, and UI preferences.
- **Selection state is a Set/Map of Entity IDs, not entity references.**

### For Serialized Data

- **Use plain JSON-serializable objects.** No class instances, no functions, no circular references.
- **Version your formats.** Include a `version` field in saved files.
- **Migration path:** If you change a format, document how old versions are upgraded.

---

## Module Design Rules

### Engine Modules (`packages/engine/`)

- **Core (ecs, gfx, math):** No dependencies on other engine modules. These are foundational.
- **Systems (rendering, physics, audio):** Depend only on core. No cross-system dependencies unless via ECS events.
- **Plugins:** Optional additions that register themselves with the engine. Must not be required by core systems.

### Editor Modules (`packages/editor/`)

- **Viewport:** Renders the engine world. Depends on engine.
- **Panels:** UI components that observe and mutate engine/editor state. Depend on engine and shared UI components.
- **Commands:** Pure functions (execute/undo/redo) that encapsulate mutations. No side effects beyond the documented state changes.
- **Shared UI:** Reusable Preact components. No engine dependencies.

### Dependency Direction

```
shared-ui ← editor-panels ← editor-viewport ← engine
                    ↑
              editor-commands
```

**Never:** Editor core → Engine internals directly (always go through public API). Engine → Editor (engine must not know editor exists).

---

## Renderer Design Rules

- **New rendering features start in WebGPU + WGSL.** The WebGL2 fallback is auto-generated by `createGfxDevice()`.
- **Shader files use `*.wgsl` extension.**
- **Uniform/binding layout must match between TS and WGSL.** Document the binding schema in a comment block.
- **Texture filtering defaults to `nearest` for pixel art.** Only override when explicitly designing for smooth graphics.
- **Render passes should be explicit.** Don't hide render target switches in helper functions.

---

## Design Checklist

Before finalizing a design, verify:

- [ ] All Components have parameterless constructors
- [ ] No cross-module dependencies violate the dependency direction graph
- [ ] Public API surface is minimal and documented
- [ ] Data that needs serialization uses plain objects with version fields
- [ ] System execution order and dependencies are documented
- [ ] GPU resource layout matches shader bindings
- [ ] Editor state is separated from engine state
- [ ] Undo/redo can be implemented as pure commands for editor features

---

## Output Format

When asked to design something, produce:

1. **Problem statement** (1-2 sentences)
2. **Constraints gathered** (answers to Phase 1 questions)
3. **Architecture decisions** (Decision / Alternatives / Rationale / Tradeoff for each)
4. **Proposed API** (TypeScript interfaces / function signatures)
5. **Data structures** (Component definitions, state shapes)
6. **Module placement** (which file/package each piece lives in)
7. **Open questions** (anything that still needs user input)

Then save the complete design document to the project root `designs/` directory:

### File Naming

```
design-{keywords}-{YYYYMMDD}.md
```

- `keywords`: 2-4 keywords describing the requirement, lowercase, hyphen-separated
- `YYYYMMDD`: current date

Examples:
- `design-health-damage-system-20260418.md`
- `design-particle-renderer-webgpu-20260418.md`
- `design-sprite-editor-blender-layout-20260418.md`

If the user hasn't provided a clear keyword summary, derive one from the requirement or ask for confirmation before saving.

### Save Location

Project root: `designs/` (create the directory if it doesn't exist)
