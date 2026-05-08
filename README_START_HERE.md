# EssayCraft Autonomous Evolution Pack — Start Here

This pack is designed to be copied into the root of `https://github.com/zhuyf25t/EssayCraft.git` before launching Codex.

It contains:

- a Next.js/TypeScript/Tailwind MVP scaffold,
- `AGENTS.md` durable rules,
- project-scoped custom subagents in `.codex/agents/`,
- reference mockup images,
- the Module 6 finish photo asset,
- module transition prompt registry files,
- specs for editor UX, progress, paragraph format, citation/source handling, module deletion/save, JSON import/export, AI assistant, translate, and autonomous self-evolution,
- a copy-paste Codex prompt in `CODEX_AUTONOMOUS_EVOLUTION_PROMPT.md`.

## Recommended local seed commands

```bash
git clone https://github.com/zhuyf25t/EssayCraft.git
cd EssayCraft
unzip ~/Downloads/essaycraft-autonomous-evolution-pack.zip -d /tmp/essaycraft-pack
rsync -av /tmp/essaycraft-pack/essaycraft-autonomous-evolution-pack/ ./
cp .env.example .env.local
# edit .env.local and add DEEPSEEK_API_KEY, but do not commit .env.local
git add .
git commit -m "chore: seed EssayCraft autonomous evolution pack"
git branch -M main
git push -u origin main
```

Then open Codex on the repo and paste `CODEX_AUTONOMOUS_EVOLUTION_PROMPT.md`.

## Important

Codex cannot access this zip unless you push its contents to the repository first. The GitHub repo is empty at the time this pack was created, so seeding the repo first is the safest path.
