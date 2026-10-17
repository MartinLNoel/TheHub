# TheHub — Part 1: Accounts and Repositories (manual)

**Depends on:** Nothing
**Branch:** N/A (no code in this part)
**Estimated effort:** 30 minutes

---

## USER ACTIONS REQUIRED

This part is entirely manual. No Claude prompt. Do the steps in order.

Already checked on 2026-10-17: Node.js 22 and npm 10 are installed on your PC. The GitHub CLI (`gh`) is not; you do
not need it, everything below uses the GitHub website.

---

### Step 1 — Create the app repository (public)

1. Go to [github.com/new](https://github.com/new).
2. **Repository name:** `TheHub`. **Owner:** `MartinLNoel`.
3. **Public** (GitHub Pages is free for public repos, and it doubles as your automation portfolio).
4. Do **not** tick "Add a README", ".gitignore" or "license": the folder already has files.
5. Click **Create repository**.

### Step 2 — Push the plan you already have

The folder `C:\Users\marti\Documents\Education\TheHub` is already a git repo with the spec and plan committed. In a
terminal there, run:

```
git remote add origin https://github.com/MartinLNoel/TheHub.git
git push -u origin main
```

Refresh the GitHub page: you should see `SPEC.md`, `CLAUDE.md` and `docs/`.

### Step 3 — Turn on GitHub Pages (deployed by Actions)

1. In the `TheHub` repo: **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Nothing deploys yet; Part 2 adds the workflow. Your app's address will be
   `https://martinlnoel.github.io/TheHub/`.

### Step 4 — Create the backup repository (private)

1. Go to [github.com/new](https://github.com/new) again.
2. **Repository name:** `thehub-backup`. **Private.**
3. **Tick "Add a README file"** (the app needs the repo to have at least one commit).
4. Click **Create repository**.

You will create the token that lets the app write here in Part 3.

### Step 5 — Check your phone

1. Make sure **Chrome** is up to date (Play Store → Chrome → Update). The app is installed from Chrome; Samsung
   Internet also works but the plan is tested in Chrome.
2. Make sure the **Claude app** is installed and you are signed in (the "Ask Claude" button hands over to it).
3. Keep **gainz-tracker** as it is on your phone. Do not clear Chrome's data: your workout history lives there until
   Part 4 moves it.

---

## What you have at the end of this part

- `MartinLNoel/TheHub` (public) with the spec and plan, and Pages set to deploy from Actions.
- `MartinLNoel/thehub-backup` (private), empty apart from a README.
- A phone ready for installing the app in Part 2.
