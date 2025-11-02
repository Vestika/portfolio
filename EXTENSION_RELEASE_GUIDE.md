# Extension Release Guide

Quick guide for releasing the Vestika Chrome Extension using GitHub Actions.

## Quick Start

### Automatic Release (Recommended)

```bash
# 1. Ensure all changes are committed and pushed
git add .
git commit -m "feat: your feature description"
git push origin main

# 2. Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions will automatically:
#    - Build dev and prod versions
#    - Generate changelog
#    - Create GitHub release
#    - Upload both zip files
```

### Manual Release

1. Go to GitHub → **Actions** tab
2. Select **Build and Release Extension**
3. Click **Run workflow**
4. Enter version (e.g., `1.0.0`)
5. Click **Run workflow**

## Version Numbers

Follow semantic versioning:

- **Major** (v2.0.0): Breaking changes
- **Minor** (v1.1.0): New features, backwards compatible
- **Patch** (v1.0.1): Bug fixes only

## What You Get

Each release includes:

1. **`vestika-extension-prod-vX.X.X.zip`**
   - For production use
   - Connects to `https://api.vestika.io`

2. **`vestika-extension-dev-vX.X.X.zip`**
   - For local development
   - Connects to `http://localhost:8080`

## Testing Before Release

```bash
cd vestika-extension

# Test build locally
cp .env.production .env
pnpm install
pnpm build

# Verify dist/ folder contents
ls -la dist/
```

## Common Commands

```bash
# View all tags
git tag -l

# Delete a local tag
git tag -d v1.0.0

# Delete a remote tag (if needed)
git push origin --delete v1.0.0

# Create annotated tag with message
git tag -a v1.0.0 -m "Release version 1.0.0"
```

## Installation Instructions

Users will find these in every release:

1. Download the zip file (prod or dev)
2. Extract the zip
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the extracted folder

## Changelog

The workflow automatically generates changelogs from your commits between tags. Write good commit messages!

**Good commit messages:**
```
feat: Add config import/export functionality
fix: Resolve authentication timeout issue
docs: Update installation instructions
```

**Poor commit messages:**
```
updates
fix stuff
wip
```

## Workflow Details

See [.github/workflows/README.md](.github/workflows/README.md) for complete documentation.

## Troubleshooting

**Build failed?**
- Check GitHub Actions logs
- Verify `vestika-extension/pnpm-lock.yaml` exists
- Test build locally first

**Release not created?**
- Ensure tag starts with `v` (e.g., `v1.0.0`, not `1.0.0`)
- Check build job completed successfully
- Verify GitHub Actions permissions

**Wrong environment?**
- Dev build uses `.env.example`
- Prod build uses `.env.production`
- Both files must exist in `vestika-extension/`

## Next Steps After Release

1. **Test the release**: Download and install the prod build
2. **Update Chrome Web Store**: Upload the prod zip (manual process)
3. **Notify users**: Post in Discord/Slack about new version
4. **Monitor**: Watch for bug reports and issues

## CI/CD Pipeline Overview

```
Code Changes
    ↓
Commit & Push
    ↓
Create Tag (v1.0.0)
    ↓
Push Tag
    ↓
GitHub Actions Triggered
    ↓
┌─────────────┬──────────────┐
│  Dev Build  │  Prod Build  │
└─────────────┴──────────────┘
         ↓
    Create Release
         ↓
Upload Artifacts + Changelog
         ↓
    Release Complete ✓
```

## Support

- Workflow documentation: `.github/workflows/README.md`
- Extension docs: `vestika-extension/README.md`
- Issues: https://github.com/your-org/portfolio/issues
