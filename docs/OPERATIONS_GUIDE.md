# Operations Guide

## Start from zero

```bash
npx create-next-app@latest essaycraft-mvp --ts --tailwind --app
cd essaycraft-mvp
```

Then copy the files from this handoff package into the same paths.

Or unzip the provided package and run:

```bash
cd essaycraft-mvp
npm install
cp .env.example .env.local
npm run dev
```

## Add DeepSeek key

Edit `.env.local`:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

Restart dev server after editing env vars.

## Use Codex

1. Push this repo to GitHub, or open it locally with Codex CLI/app.
2. Ensure `AGENTS.md` is at repo root.
3. Paste `CODEX_MASTER_PROMPT.md` into Codex.
4. Allow Codex to run install/build/test commands.
5. Review its diff before accepting.

## Suggested Git workflow

```bash
git init
git add .
git commit -m "Initial EssayCraft MVP handoff"
# create GitHub repo, then:
git remote add origin <repo-url>
git push -u origin main
```

## Deployment later

For Vercel, add these environment variables in the project settings:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

Do not add secrets to the client.
