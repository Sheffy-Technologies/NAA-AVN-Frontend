# Release Playbook

End-to-end steps to ship a new desktop release. Triggers the GitHub Actions
workflow at [.github/workflows/release.yml](.github/workflows/release.yml),
which builds signed installers for macOS/Linux/Windows and publishes a
GitHub Release containing `latest.json` (consumed by the in-app updater).

---

## 0. One-time setup (already done — for reference)

- Generated signing keypair: `npm exec tauri signer generate -- -w ~/.tauri/avn.key`
- Backed up `~/.tauri/avn.key` somewhere safe.
- Public key pasted into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
- Repo secrets (Settings → Secrets and variables → Actions):
  - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `~/.tauri/avn.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password (or empty)

---

## 1. Pick the next version

Use [SemVer](https://semver.org):

- Bug fixes only → bump patch: `0.2.0` → `0.2.1`
- New features, no breakage → bump minor: `0.2.1` → `0.3.0`
- Breaking changes → bump major: `0.3.0` → `1.0.0`

Set a shell variable so the rest of the steps are copy-paste safe:

```bash
NEW_VERSION=0.2.1
```

---

## 2. Make sure your working tree is clean and up to date

```bash
git checkout main          # or whichever branch you release from
git pull --rebase
git status                 # must be clean
```

---

## 3. Bump the version in BOTH manifests

They MUST match, otherwise the Windows/Linux/macOS bundlers and the
updater will look for mismatched filenames.

```bash
# package.json (no tag yet — we tag manually after editing tauri.conf.json)
npm version "$NEW_VERSION" --no-git-tag-version

# src-tauri/tauri.conf.json (edit by hand, or with sed):
sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Verify both say the same thing:
grep '"version"' package.json src-tauri/tauri.conf.json
```

> On Linux, drop the `''` after `-i`.

---

## 4. Commit, tag, push

```bash
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: release v$NEW_VERSION"
git push

git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"
```

The tag push triggers the `Release` workflow.

---

## 5. Watch the build

GitHub repo → **Actions** tab → latest "Release" run.
Expect ~15–25 min for all four matrix jobs (macOS ARM, macOS Intel, Linux, Windows).

---

## 6. Verify the published release

Repo → **Releases** → `vX.Y.Z`. Should contain:

- macOS: `*.dmg` + `*.app.tar.gz` + `.sig` files (both arm64 and x64)
- Linux: `*.AppImage` + `*.deb` + `.sig` files
- Windows: `*_x64_en-US.msi` + `*_x64-setup.exe` + `.sig` files
- **`latest.json`** ← required for auto-update

Sanity check:

```bash
curl -s https://github.com/Sheffy-Technologies/NAA-AVN-Frontend/releases/latest/download/latest.json | head
```

Should print JSON with `"version": "X.Y.Z"`.

---

## 7. Test the auto-update

1. Install the **previous** version on a test machine.
2. Launch it.
3. Within a few seconds the bottom-left UpdateBanner should show
   "Update available · vX.Y.Z".
4. Click **Install Update** → progress bar → **Restart Now**.
5. After relaunch, confirm the new version in the app's About / window title.

---

## Rollback / re-do a botched tag

If the workflow failed because of a bad commit or wrong version,
delete the tag and the partial release, then redo from step 3:

```bash
# Local + remote tag delete
git tag -d "v$NEW_VERSION"
git push origin ":refs/tags/v$NEW_VERSION"

# Then go to repo → Releases → vX.Y.Z → Delete release
# (otherwise tauri-action errors on re-upload)
```

---

## One-liner cheat sheet

```bash
NEW_VERSION=0.2.1 \
  && npm version "$NEW_VERSION" --no-git-tag-version \
  && sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json \
  && grep '"version"' package.json src-tauri/tauri.conf.json \
  && git add package.json src-tauri/tauri.conf.json \
  && git commit -m "chore: release v$NEW_VERSION" \
  && git push \
  && git tag "v$NEW_VERSION" \
  && git push origin "v$NEW_VERSION"
```
