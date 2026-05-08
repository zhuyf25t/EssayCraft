# UI Behavior

## Layout

```text
┌──────────────────────────────────────────────┐
│ EssayCraft | Topic input | Module n of 6      │
│ Prev Next Generate Next Refresh Save Export   │
├─────────┬────────────────────────────────────┤
│ Module1 │ Colored editable editor             │
│ Module2 │ Patch box appears after Enter       │
│ Module3 │ Snapshot panel on the side          │
│ Module4 │                                    │
│ Module5 │                                    │
│ Module6 │                                    │
├─────────┴────────────────────────────────────┤
│ Highlight Key                                │
└──────────────────────────────────────────────┘
```

## Keyboard

- Click sentence: select and edit.
- Enter on sentence: prevent default newline, open patch box.
- Patch box Enter: save and close.
- Patch box Shift+Enter: newline.
- Patch box Escape: cancel.

## Color labels

- Yellow: Background
- Pink: Thesis
- Green: Evidence
- Blue: Analysis
- Purple: Counterargument
- Gray: Citation
- Orange: Conclusion
- Red: Issue

## Module 6 finish modal

When the current module is Module 6 and the user chooses Download HTML, show the finish modal first. The modal uses `public/assets/essaycraft-finish-photo.jpg` and credits the course inspiration without identifying people in the image.
