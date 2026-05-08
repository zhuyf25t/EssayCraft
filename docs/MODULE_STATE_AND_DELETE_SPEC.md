# Module State, Save, Snapshot, and Delete Spec

## Independent module storage

Each module must save independently. Switching modules must never overwrite another module unless the user explicitly clicks Generate Next.

Each `ModuleDocument` stores:

- title
- text
- annotations
- patches
- snapshots
- sources
- assistant history or module notes if useful
- updatedAt

## Save behavior

- Auto-save current project to localStorage or IndexedDB after edits.
- Provide Save Snapshot button for the current module.
- Show last saved time/status.

## Generate Next overwrite

When Module N generates Module N+1:

1. Snapshot Module N+1.
2. Call `/api/generate-next` with Module N content, annotations, patches, topic, and source cards.
3. Validate JSON.
4. Overwrite Module N+1 only.
5. Switch to Module N+1.
6. Show status: `Module N+1 generated. Previous version saved.`

## Delete/Clear Current Module

Add a visible but not scary button, e.g. `Clear Module` or trash icon in current module toolbar.

Behavior:

1. Ask confirmation: `Clear Module N content? A snapshot will be saved first.`
2. Snapshot current module.
3. Clear text, annotations, patches, assistant selection state.
4. Keep snapshots.
5. Keep module title and source cards only if user chooses; default MVP can clear sources too, but document behavior.
6. Show restore option from snapshot panel.

Never delete all modules with this button.

## Reset Demo

Reset Demo is separate from Clear Module. It may reset the entire project, but must ask confirmation.
