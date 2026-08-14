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

A Golden candidate remains a candidate while any high-impact interaction language is unresolved, while the representative flow has not been accepted, or while screenshot evidence has not reached `Captured -> Model Visible -> Visual Reviewed`. Similar data shape, boolean implementation, or visual resemblance is not sufficient evidence that two controls belong to the same reusable pattern.

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

This brief should eventually become repository-native structured state rather than living only in chat. Until the canonical schema is extended, this document is the product contract for how Forge Design agents and UI should reason about design work.

## Direction for the Forge Design product model

The current repository-native model (`tokens`, `components`, `screens`) remains valid for visual assets, but it is not sufficient as the long-term complete product-design model.

Future schema/API/UI work should make upstream product design first-class and reviewable, with concepts equivalent to:

- product brief / user jobs
- journeys or flows connecting related screens
- information roles
- state semantics
- interaction-pattern contracts
- Screen Family classification
- Golden/reference relationships
- runtime review evidence

Screens should reference these decisions instead of silently owning them. Components and tokens remain downstream implementation contracts.
