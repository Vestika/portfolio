#!/bin/bash

# Script to create GitHub repository
# Usage: ./create_github_repo.sh YOUR_GITHUB_TOKEN

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <github_token>"
    echo "Get your token from: https://github.com/settings/tokens"
    echo "Make sure it has 'repo' scope"
    exit 1
fi

TOKEN=$1

echo "Creating repository 'portfolio'..."

curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "portfolio",
    "description": "Portfolio Management Application - Migrated from Trello",
    "private": false,
    "has_issues": true,
    "has_projects": true,
    "has_wiki": true
  }'

echo -e "\n✅ Repository created! You can now run the migration script." 