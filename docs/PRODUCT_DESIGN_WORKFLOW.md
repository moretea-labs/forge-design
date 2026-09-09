# Product design workflow

Forge Design is not only a UI composition tool. Its design model must help humans and AI move from a real user need to a coherent product flow, and only then to screens, components, tokens, and visual polish.

## Product position

A rendered screen is an output of product decisions, not the starting point. Forge Design should make the reasoning that materially changes product behavior and presentation reviewable alongside the visual result.

The default design sequence is:

`User need / job -> product goal and business semantics -> journey / flow -> information model -> state model -> interaction model -> Screen Family -> composition and hierarchy -> system interaction patterns -> visual design -> tokens -> runtime screenshot / interaction review -> sibling validation -> reusable system rule`

Skipping directly from a feature name to a screen layout is a design failure unless the upstream product decisions are already explicit and stable.

## 1. User need and job

Before editing a screen, state why the user enters this product flow and what outcome they are trying to achieve.

Required questions:

- What is the primary user job?
- What are the primary and secondary tasks?
- Is the experience primarily reading, managing, creating, editing, deciding, monitoring, searching, comparing, or exporting?
- What must the user understand or accomplish before leaving the flow?

Feature-area membership is not enough. Two screens in the same health, finance, or settings area may require completely different product and interaction models.

## 2. Review the whole product flow

Do not redesign one screen in isolation when its meaning depends on adjacent steps. Review the complete user journey that owns the same product logic, for example:

`management/list -> search/filter -> create -> save -> detail -> edit -> delete/archive -> return to management`

The review must check that the information users enter, the information emphasized after saving, and the information used to find the record later are semantically aligned.

A validated flow is a transition graph, not an ordered screenshot list. Each flow declares an entry screen/state and transitions with the semantic trigger, optional guard, persistence commit boundary, result, destination screen/state, and explicit recovery targets when failure changes the user path. `screenIds` remains a compatibility/index field; it is not sufficient evidence for Golden promotion.

A list row cannot be designed correctly without understanding what the create/edit flow captures and what the detail screen considers important.

## 3. Information model

Classify information by user meaning before deciding how to render fields.

Typical roles include:

- identity / anchor
- primary meaning or conclusion
- evidence / measurements
- action / outcome
- status / exception
- next required action
- context / provenance
- supporting metadata

Do not turn every stored field into an equal visual object. Data-model equality is not information-hierarchy equality.

## 4. State model

Enumerate states that can materially change user decisions or interaction before designing visual treatment.

Examples:

- empty / populated
- normal / abnormal
- active filter / default scope
- scheduled / overdue / completed
- editable / read-only
- draft / saved / backfilled
- loading / failed / unavailable

Only states that deserve attention should receive strong visual treatment. A state existing in the data model does not justify a badge, pill, card, or accent color.

Screen state variants belong to one Screen Spec when they preserve the same page identity and User Job. Normal, empty, loading, error, degraded, historical, disabled, or domain-specific states must not be modeled as unrelated screens merely to obtain different screenshots. The base Screen composition supplies defaults; a named state may override primary action, constraints, or composition while keeping one screen identity.

## 5. Interaction model

Define how the user acts before choosing control styling.

For each interaction, establish:

- intent
- trigger
- result
- persistence effect
- navigation effect
- destructive or reversible semantics
- relationship to the rest of the flow

Product semantics choose the interaction pattern. Visual components implement that pattern; they do not define it.

## 6. Screen Family and composition

Classify the screen by its primary job only after the product flow is understood. A Screen Family defines reusable composition grammar, not identical layout.

Examples include dashboard, management workspace, dense read-only detail, document/export preview, editor/form flow, and selection workspace.

Golden/reference screens transfer proven hierarchy and product feel only inside compatible product semantics. A Golden is evidence, not a template to copy across unrelated jobs.

## 7. System interaction patterns

Forge Design must distinguish page composition from system-wide semantic interaction patterns.

Equivalent semantics should use the same product pattern across sibling screens unless an explicit product reason requires divergence. Examples:

- Search
- Filter and active-filter state
- Sort
- Add/create
- Edit
- Delete/destructive action
- Toggle / boolean preference
- Selection
- Disclosure / navigate to detail
- Date or range selection
- Modal / sheet
- Empty state
- Warning / abnormal state

Consistency has four layers:

1. **Semantic consistency** — the same affordance means the same thing.
2. **Interaction consistency** — the same intent behaves the same way.
3. **Component consistency** — compatible instances reuse the same system component/contract.
4. **Composition consistency** — only sibling screens with the same Screen Family share composition grammar.

A shared icon is part of this contract. If the product uses one canonical filter meaning, sibling screens should not arbitrarily alternate among unrelated filter icons or interaction forms.

### Component contracts and design preview

A reusable component contract describes product semantics before implementation details. Modern contracts should declare typed props, meaningful variants/states, interaction role, layout and accessibility constraints, and optional implementation-binding metadata. A component preview is project-owned declarative composition built from Forge Design primitives and token references; it must not execute arbitrary project code or require Forge Design core to know business-specific component names. Legacy `allowedProps` contracts remain readable for compatibility, but they are insufficient evidence for a mature reusable component family.

The production implementation may later bind to the accepted component contract, but production code is downstream delivery evidence and never becomes the visual-design authority during Phase C.

## 8. Visual design and tokens

Only after product hierarchy and interaction are stable should the workflow choose typography roles, color roles, spacing, radius, surfaces, icon treatment, and other tokens.

Tokens enforce implementation consistency. They cannot rescue an incorrect product model, information hierarchy, or interaction flow.

## 9. Evidence and review

Static code validation is not visual acceptance. For a user-visible redesign, review the real rendered product and, where relevant, the interaction path.

Review order:

1. Does the flow solve the intended user job?
2. Are primary and secondary tasks obvious?
3. Is information hierarchy correct?
4. Are important states visible without over-decoration?
5. Are interactions semantically consistent with the rest of the product?
6. Is composition appropriate for the Screen Family?
7. Does the rendered screen have sufficient hierarchy, density, alignment, and product finish?
8. Only then review token and component conformance.

## 10. Sibling validation and promotion

Do not promote a local screen pattern into a global design rule immediately.

A pattern becomes reusable only after:

- the representative product flow is validated;
- at least one compatible sibling use case is checked, or the rule is inherently system-wide (for example canonical Search or Filter semantics);
- the shared abstraction preserves the same product meaning;
- runtime evidence shows that reuse improves consistency without forcing unrelated screens into the same composition.

A Golden is not only a polished screen. Promotion should produce three linked assets:

1. **Product Design Contract** — the User Job, journey, information roles, state semantics, interaction model, editable/read-only boundaries, and preserved business meaning;
2. **Screen / Flow Golden** — the validated composition and hierarchy across the representative user journey, not only one screenshot;
3. **Interaction Pattern Golden** — system patterns such as Search, Filter, Selection, Toggle, Primary Action, Sheet, and destructive actions that have been proven in real product semantics.

A Golden candidate remains a candidate while any high-impact interaction language is unresolved or screenshot evidence has not reached `Captured -> Model Visible -> Visual Reviewed`. Similar data shape, boolean implementation, or visual resemblance is not sufficient evidence that two controls belong to the same reusable pattern. Family-level human acceptance is recorded separately on Design Units after visual review; an AI must not encode its own approval through an ordinary design write.

## Product Design Brief

Before a meaningful redesign, Forge Design should be able to represent a compact brief containing at least:

- User Job
- Primary / Secondary Tasks
- Journey / Related Screens
- Information Hierarchy
- State Model
- Interaction Model
- Screen Family
- System Patterns used
- Golden / references
- Non-goals and preserved semantics
- Review evidence

For self-contained projects, this brief is repository-native structured state in `.design-harness/product.json`. Larger products may keep a mature Product Contract elsewhere in the target repository; `.design-harness/design-units.json` then pins exact revision/path references and acts as the design projection boundary. Screens and visual assets remain downstream of whichever upstream product authority is explicitly referenced.

## Repository-native Product Contract

`product.json` makes embedded upstream design decisions first-class and Git-reviewable. It must not replace an already-authoritative external Product Contract merely to satisfy the design tool. It contains:

- Product Brief status (`draft` / `ready`) and User Job;
- product goal, primary/secondary tasks, business and preserved semantics;
- ordered information roles, state semantics, and interaction semantics;
- Screen Family;
- full product flows and their validation state;
- Interaction Pattern candidates, their validated flows, owner, and sibling evidence;
- Golden membership and review evidence.

The embedded Product Golden Gate remains fail-closed compatibility behavior for self-contained/legacy projects. `golden.status = approved` is invalid unless the Product Brief is ready, all selected flows are validated, promoted patterns have compatible sibling evidence, runtime artifacts exist, review has reached `visual_reviewed`, and its legacy user decision is `accepted`. Ordinary current design writes cannot change that legacy user-decision field. New multi-family implementation handoff uses Design Unit acceptance and project freeze instead of treating this embedded gate as a universal approval authority.

Runtime review stages are intentionally distinct:

`not_started → captured → model_visible → visual_reviewed`

- **Captured**: a concrete screenshot/runtime artifact exists.
- **Model Visible**: the reviewer actually received or decoded the pixels. An `image/png` path or artifact candidate alone is not sufficient.
- **Visual Reviewed**: composition, hierarchy, density, alignment, interaction presentation, and product finish were actually assessed.
- **Human Accepted** is a separate decision from visual review. For current Design Units it is written only through a strongly confirmed acceptance action against an exact clean Git revision and deterministic design digest.

### Review Profiles and Design Freeze

Each reviewable Design Unit declares the Review Profiles that materially test its design: viewport/safe area, color scheme, text scale, contrast review mode, and reduced-motion behavior. Profiles are part of the design digest. The Web workspace must actually project those values; a profile name alone is not review evidence. A used dark profile requires dark token overrides. Increased-contrast preview is a design-review aid, not a promise of pixel-identical OS rendering.

After visual review, explicit user acceptance records an exact pre-evidence Git revision plus the unit digest. The acceptance metadata itself is excluded from the digest so committing the evidence does not self-invalidate it. Any later design change that affects the digest makes acceptance stale. The project may be frozen only when every Design Unit has current acceptance and project validation succeeds. This current project freeze is the gate from completed design into production implementation.

This prevents test success, screenshot creation, transport metadata, or an AI-authored `accepted` field from being mislabeled as human approval. Components and tokens remain downstream implementation contracts.
