# Trello to GitHub Migration Guide

This guide will help you migrate your Trello board to GitHub Issues and Project Boards while preserving all the important information and organization.

## Overview

Your Trello board contains:
- **6 Lists**: UI/UX (General), Analysis (Main), Exploration (Secondary), Going Live, Quality & Performance, Bugs
- **37 Cards**: Mix of features, enhancements, bugs, and tech debt items
- **4 Labels**: Feature (green), Enhancement (blue), Release Candidate (red), Tech Debt (yellow)
- **Detailed descriptions** and **checklists** on many cards
- **Completion status** tracking

## Migration Strategy

### 1. GitHub Labels
Your Trello labels will be mapped to GitHub labels:
- **Feature** (green) → GitHub green label
- **Enhancement** (blue) → GitHub blue label  
- **Release Candidate** (red) → GitHub red label
- **Tech Debt** (yellow) → GitHub yellow label

### 2. GitHub Issues
Each Trello card becomes a GitHub issue with:
- **Title**: Trello card name
- **Body**: Contains original description, checklists, and metadata
- **Labels**: Mapped from Trello labels
- **State**: Open/Closed based on completion status
- **Reference**: Link back to original Trello card

### 3. GitHub Project Board
A new GitHub Project will be created with columns matching your Trello lists:
- UI/UX (General)
- Analysis (Main)
- Exploration (Secondary) 
- Going Live
- Quality & Performance
- Bugs

## Prerequisites

1. **GitHub Personal Access Token** with the following scopes:
   - `repo` (full control of private repositories)
   - `write:org` (if migrating to an organization repository)
   - `project` (project access)

   Create one at: https://github.com/settings/tokens

2. **Python 3.7+** installed
3. **requests** library: `pip install requests`

## Migration Steps

### Step 1: Preview Migration (Dry Run)

First, let's see what would be created without actually creating anything:

```bash
python migrate_trello_to_github.py \
  --token YOUR_GITHUB_TOKEN \
  --owner YOUR_GITHUB_USERNAME \
  --repo YOUR_REPO_NAME \
  --dry-run
```

### Step 2: Run the Migration

After reviewing the dry run output, run the actual migration:

```bash
python migrate_trello_to_github.py \
  --token YOUR_GITHUB_TOKEN \
  --owner YOUR_GITHUB_USERNAME \
  --repo YOUR_REPO_NAME
```

### Step 3: Post-Migration Tasks

After migration, you'll want to:

1. **Review created issues** and organize them in the project board
2. **Set up issue templates** for future issues
3. **Configure project board automation** 
4. **Archive the Trello board** once you're satisfied

## Issue Template Setup

Create `.github/ISSUE_TEMPLATE/` directory with templates for different issue types:

### Feature Request Template
```yaml
name: Feature Request
about: Suggest a new feature for the portfolio application
title: '[FEATURE] '
labels: Feature
assignees: ''
```

### Bug Report Template  
```yaml
name: Bug Report
about: Report a bug in the portfolio application
title: '[BUG] '
labels: bug
assignees: ''
```

### Enhancement Template
```yaml
name: Enhancement
about: Suggest an improvement to existing functionality
title: '[ENHANCEMENT] '
labels: Enhancement
assignees: ''
```

## Project Board Configuration

### Recommended Columns
After migration, consider reorganizing into a more development-focused workflow:

1. **Backlog** - New issues and feature requests
2. **Ready** - Issues ready for development
3. **In Progress** - Currently being worked on
4. **Review** - Waiting for code review
5. **Testing** - Being tested
6. **Done** - Completed issues

### Automation Rules
Set up GitHub Project automation to:
- Move issues to "In Progress" when assigned
- Move to "Review" when PR is opened
- Move to "Done" when PR is merged
- Auto-close completed issues

## Maintaining Your Workflow

### Using GitHub Issues Effectively

1. **Link Issues to PRs**: Use keywords like "Closes #123" in PR descriptions
2. **Use Milestones**: Group related issues into releases
3. **Apply Labels Consistently**: Maintain the label system from Trello
4. **Reference Issues**: Use "#123" to link between issues

### Integration with Your Development Workflow

Since you're using:
- **FastAPI** backend
- **React/TypeScript** frontend  
- **GitHub Actions** for CI/CD

Consider these integrations:
- Link issues to specific components/files
- Use issue numbers in commit messages
- Create PR templates that reference issues
- Set up automated testing that references issues

## Backup and Rollback

### Before Migration
1. Export your Trello board data (already done - `trello.json`)
2. Backup any existing GitHub issues/projects
3. Have a rollback plan ready

### If Something Goes Wrong
The migration script creates issues incrementally, so you can:
1. Stop the script if errors occur
2. Delete created issues manually or via API
3. Fix the issue and re-run from where it stopped

## Advanced Usage

### Custom Label Mapping
Edit the `_trello_to_github_color()` function to customize label colors.

### Selective Migration
Modify the script to migrate only specific lists or cards by adding filters in the `parse_trello_data()` function.

### Post-Migration Data Enhancement
After migration, you can enhance issues with:
- Additional labels for components (frontend/backend)
- Difficulty estimates
- Story points
- Component assignments

## Troubleshooting

### Common Issues

1. **Rate Limiting**: The script includes delays, but GitHub has rate limits
   - **Solution**: The script will pause automatically

2. **Permission Errors**: Token doesn't have required permissions
   - **Solution**: Check token scopes at https://github.com/settings/tokens

3. **Duplicate Labels**: Labels already exist in repository
   - **Solution**: Script handles this gracefully and will reuse existing labels

4. **Large Descriptions**: Very long Trello descriptions might hit GitHub limits
   - **Solution**: Script truncates if needed, full content preserved in Trello link

### Getting Help

If you encounter issues:
1. Check the script output for error messages
2. Verify your GitHub token permissions
3. Try the dry-run mode first
4. Check GitHub API status at https://www.githubstatus.com/

## Post-Migration Benefits

After migrating to GitHub Issues, you'll have:

✅ **Better Integration** with your code repository  
✅ **Automated Workflows** via GitHub Actions  
✅ **Enhanced Collaboration** with PR/issue linking  
✅ **Better Search** and filtering capabilities  
✅ **API Access** for custom automations  
✅ **Milestone Tracking** for releases  
✅ **Native Git Integration** for development workflow  

## Example Workflow

Here's how your development workflow might look after migration:

1. **Planning**: Review issues in Project Board
2. **Development**: Assign issue, move to "In Progress"
3. **Implementation**: Create branch with issue number
4. **Review**: Open PR that references issue
5. **Testing**: Move to testing column
6. **Deployment**: Merge PR, issue auto-closes
7. **Tracking**: Monitor via Project Board and milestones

Ready to migrate? Start with the dry-run command above! 🚀 