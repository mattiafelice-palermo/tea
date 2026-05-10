# Anode Mass/Capacity Coupling Notes

## Context

Current architecture intentionally keeps structural inputs and performance mostly decoupled:

- raw materials/components/cell builder/scenario/modules define deterministic base state
- studies adds an explicit overlay of hypothetical relationships

This is clean for MVP, but it means causality such as:

- anode mass -> discharge capacity

is optional and can be forgotten by users.

## Core modeling tension

Two competing truths must be preserved:

1. In many designs, less anode mass should reduce usable capacity.
2. In some designs, anode has reserve/excess mass, so reducing total anode mass may not affect capacity immediately.

Example:

- total Zn mass = 1.0 g
- design uses only 0.2 g per discharge target
- reducing total Zn from 1.0 g to 0.6 g should not necessarily change capacity if 0.2 g remains usable

So a hard-coded automatic coupling would be wrong for part of the design space.

## Recommended direction (future)

Introduce explicit coupling modes, not implicit automation:

- `decoupled` (current behavior)
- `anode_coupled` (capacity derived from available/usable anode mass)
- later: `limiting_electrode` (full electrochemical balance mode)

In `anode_coupled` mode, require explicit parameters:

- usable anode mass rule (fixed fraction, cap, or threshold)
- utilization assumption (constant first, function later)
- specific capacity assumption
- optional reserve threshold where capacity remains flat until exhausted

## UX guardrails (future)

When anode mass is varied in studies:

- if coupling mode is `decoupled`, show warning:
  - "Anode mass is varying while capacity stays fixed."
- if coupled, show derived relation preview:
  - effective usable anode mass
  - implied capacity change

## Why this order

This keeps today’s clean MVP behavior while creating a physically meaningful path forward without hidden assumptions.

