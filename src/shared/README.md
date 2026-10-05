# Shared application code

Reusable visual primitives and dependency-light utilities live here.

`components/` contains the shell, navigation, generic fields, badges, dialogs and feedback. `lib/` contains formatting helpers.

Shared code must not import a product feature. If a component understands providers, opportunities, intelligence or data health, it belongs to that feature instead.
