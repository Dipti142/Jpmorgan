# Orientation persona

Empty by design — awaiting requirements. Nothing here is registered, so the
folder costs nothing at runtime.

## What already exists for it

Everything shared sits directly in its layer folder and is already in use by the
interview, so orientation is not starting from scratch:

| Need | Already there |
| --- | --- |
| Never sounds like software, spoken-number style, never invents a figure | [`constants/prompt.rules.ts`](../prompt.rules.ts) |
| US spoken form for money, dates, times, durations, phone, email | [`helpers/speech.helper.ts`](../../helpers/speech.helper.ts) |
| Knowledge base | Anam holds the documents and searches them itself. Put markdown in [`knowledge/`](../../../knowledge/) and run `sync:knowledge:dev`; the persona reaches it through its `search_knowledge` `SERVER_RAG` tool. |
| "I don't have that, someone will follow up" | [`services/escalation.service.ts`](../../services/escalation.service.ts) — routing only; the escalation itself is stored on the call row |
| Persona, avatar and voice selection | [`services/persona.service.ts`](../../services/persona.service.ts) |
| Persona assembly, tool attachment | [`services/anam.service.ts`](../../services/anam.service.ts), [`anamSession.service.ts`](../../services/anamSession.service.ts), [`anamTool.service.ts`](../../services/anamTool.service.ts) |
| System prompt assembly | [`services/prompt.service.ts`](../../services/prompt.service.ts) |
| Validate, await, turn a throw into a response | [`helpers/controller.helper.ts`](../../helpers/controller.helper.ts) |
| Programme and script storage | `tl_persona_program` — one row per company and kind, whole script in its `script` JSONB column. Already kind-agnostic and job-scopable. |
| Recording a call, its transcript and its answers | `tl_interview_call` / `_turn` / `_answer` — the call row is the interview, and only `program_kind` ties it to one |

## The files to add

An `orientation/` folder in each layer, mirroring `interview/` exactly:

```
constants/orientation/     orientation.script.ts     ALL static text
                           orientation.tools.ts      tool blueprints, unprefixed
interfaces/                IOrientation.interface.ts
repositories/orientation/  orientation.repository.ts every read and write, company-scoped
services/orientation/      orientation.service.ts    the behaviour
controllers/orientation/   orientation.controller.ts       staff reads
                           orientationTools.controller.ts  the /tools/* webhooks Anam calls
routes/orientation/        orientation.route.ts
validators/orientation/    orientation.validator.ts
```

## The three wiring points

1. Add `{ manifest, tools }` to `PROGRAMS` in
   [`services/programRegistry.service.ts`](../../services/programRegistry.service.ts).
2. Uncomment the `orientation` line in [`routes/index.ts`](../../routes/index.ts).
   `app.ts` does not change.
3. Nothing in the schema. `tl_persona_program`, `tl_interview_call` and its two
   children, `tl_anam_avatar` and `tl_anam_tool` are all shared, so an
   orientation records answers on the same tables. The persona itself is not a
   table - it is authored in `constants/orientation/orientation.script.ts` and
   read from the registry.

Then `npm run sync:persona:dev` and `npm run provision:anam:dev`.

## The one thing to decide first

Orientation *tells* rather than *asks*, which is the opposite of the interview.
That changes what a "question" means: the interview records an answer per
question, whereas orientation more likely needs to record that a topic was
covered and understood, plus any question raised about it. Worth settling before
the script file is written, because it decides whether orientation reuses the
answer-per-question shape or wants a simpler acknowledged/not-acknowledged one.
The checklist heading above it carries over either way — a topic still groups.
