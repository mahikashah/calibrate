---
name: Question generation modes
description: The two-mode contract for question generation (real model vs explicit demo) and the persistence rules a failed generation must obey.
---

# Two explicit generation modes, never a fallback

Question generation runs in exactly one of two modes, chosen by an explicit
environment flag read in a single place (the generate API route):

- **Real model** — the app calls the Python service, which calls the hosted
  model. Any failure surfaces as a student-facing message with a mapped HTTP
  status. It must never quietly substitute deterministic/demo questions.
- **Explicit demo** — deterministic questions built locally, but travelling the
  *same* path as real output: same structured schema, same subject/material
  linkage, same persistence, same "generated" review status, same approve-then-
  study gate. The response reports which mode actually ran, and the UI labels
  demo output as a demo generator rather than as AI output.

**Why:** an earlier design fell back to an offline generator when the model was
unavailable, so students could not tell whether their study data came from their
own notes via the model or from a stub. The product's whole claim is that the
evidence is real, so a silent substitution is worse than an error.

**How to apply:** when touching generation, keep the mode flag read in one
place, keep both branches mapping to identical database rows, and never add a
`catch` that returns demo questions. A UI that advertises a fallback ("used the
offline generator instead") is a bug even if the fallback code is gone.

# A failed generation must not leave state behind

Saving material and generating questions is one user intent. Persist the
material only after generation succeeds, and when the client saved the material
first, have the retry reuse that saved material instead of saving it again.

**Why:** the original order (save material, then generate) left an empty
material in the library on every failure, and each "Try again" added another
duplicate — the student had to clean up after an error that was not theirs.

**How to apply:** server-side, generate before insert. Client-side, hold the
saved material id in state, reuse it on retry, and clear it when the student
edits the notes or title (the saved copy is then stale).
