#!/usr/bin/env python3
"""
Trello to GitHub Migration Tool
Migrates Trello board data to GitHub Issues and Project Board
"""

import json
import requests
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import argparse
import os
from pathlib import Path

@dataclass
class GitHubConfig:
    token: str
    owner: str
    repo: str
    base_url: str = "https://api.github.com"

@dataclass
class TrelloCard:
    id: str
    name: str
    desc: str
    list_name: str
    labels: List[str]
    closed: bool
    due_complete: bool
    checklists: List[Dict]
    url: str

class GitHubMigrator:
    def __init__(self, config: GitHubConfig):
        self.config = config
        self.headers = {
            "Authorization": f"token {config.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        self.created_issues = {}
        self.project_id = None
        
    def create_github_labels(self, trello_labels: Dict[str, Any]) -> Dict[str, str]:
        """Create GitHub labels matching Trello labels"""
        label_mapping = {}
        
        for label_id, label_data in trello_labels.items():
            if label_data.get('name'):  # Only create labels that have names
                github_label = {
                    "name": label_data['name'],
                    "color": self._trello_to_github_color(label_data['color']),
                    "description": f"Migrated from Trello - {label_data['color']} label"
                }
                
                # Create or update label
                try:
                    response = requests.post(
                        f"{self.config.base_url}/repos/{self.config.owner}/{self.config.repo}/labels",
                        headers=self.headers,
                        json=github_label
                    )
                    if response.status_code == 201:
                        print(f"✅ Created label: {label_data['name']}")
                        label_mapping[label_id] = label_data['name']
                    elif response.status_code == 422:  # Label already exists
                        print(f"ℹ️  Label already exists: {label_data['name']}")
                        label_mapping[label_id] = label_data['name']
                    else:
                        print(f"❌ Failed to create label {label_data['name']}: {response.status_code}")
                        
                except Exception as e:
                    print(f"❌ Error creating label {label_data['name']}: {e}")
                    
        return label_mapping
    
    def _trello_to_github_color(self, trello_color: str) -> str:
        """Map Trello colors to GitHub label colors"""
        color_mapping = {
            'green': '0E8A16',
            'blue': '0052CC', 
            'red': 'D93F0B',
            'yellow': 'FBCA04',
            'orange': 'F9D71C',
            'purple': '5319E7',
            'pink': 'E99695',
            'sky': '74C0FC',
            'lime': '7BDCB5',
            'black': '000000'
        }
        return color_mapping.get(trello_color, '808080')  # Default to gray
    
    def create_github_issue(self, card: TrelloCard, label_mapping: Dict[str, str]) -> Optional[int]:
        """Create a GitHub issue from a Trello card"""
        
        # Build issue body
        body_parts = []
        
        if card.desc:
            body_parts.append(f"## Description\n{card.desc}")
            
        # Add Trello metadata
        body_parts.append(f"\n## Trello Information")
        body_parts.append(f"- **Original List**: {card.list_name}")
        body_parts.append(f"- **Trello URL**: {card.url}")
        body_parts.append(f"- **Status**: {'✅ Completed' if card.due_complete else '🔄 In Progress'}")
        
        # Add checklists
        if card.checklists:
            body_parts.append(f"\n## Checklists")
            for checklist in card.checklists:
                if checklist.get('checkItems'):
                    body_parts.append(f"\n### {checklist.get('name', 'Checklist')}")
                    for item in checklist['checkItems']:
                        checkbox = '[x]' if item.get('state') == 'complete' else '[ ]'
                        body_parts.append(f"- {checkbox} {item.get('name', '')}")
        
        body = "\n".join(body_parts)
        
        # Map labels
        github_labels = []
        for label in card.labels:
            if label in label_mapping:
                github_labels.append(label_mapping[label])
        
        # Create issue
        issue_data = {
            "title": card.name,
            "body": body,
            "labels": github_labels,
            "state": "closed" if card.due_complete else "open"
        }
        
        try:
            response = requests.post(
                f"{self.config.base_url}/repos/{self.config.owner}/{self.config.repo}/issues",
                headers=self.headers,
                json=issue_data
            )
            
            if response.status_code == 201:
                issue = response.json()
                print(f"✅ Created issue #{issue['number']}: {card.name}")
                return issue['number']
            else:
                print(f"❌ Failed to create issue for '{card.name}': {response.status_code}")
                print(response.text)
                return None
                
        except Exception as e:
            print(f"❌ Error creating issue for '{card.name}': {e}")
            return None
    
    def create_project_board(self, board_name: str, lists: List[str]) -> Optional[str]:
        """Create a GitHub Project Board using Projects v2 API"""
        
        # Note: Projects v2 requires GraphQL API, but for simplicity we'll skip project creation
        # and just mention it in the output. Users can create projects manually.
        print(f"⚠️  GitHub Projects v2 requires GraphQL API. Skipping project board creation.")
        print(f"📝 To create a project board manually:")
        print(f"   1. Go to https://github.com/orgs/{self.config.owner}/projects")
        print(f"   2. Click 'New project'")
        print(f"   3. Name it: '{board_name} - Migrated from Trello'")
        print(f"   4. Add columns: {', '.join(lists)}")
        print(f"   5. Link issues to the project manually")
        
        return None
    
    # def _create_project_column(self, project_id: str, column_name: str):
    #     """Create a column in the project board - DEPRECATED"""
    #     # This method is no longer used since Projects v2 uses a different structure
    #     pass

def parse_trello_data(trello_file: str) -> tuple[Dict, List[TrelloCard], List[str]]:
    """Parse Trello JSON data"""
    with open(trello_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract labels
    labels = {}
    for label in data.get('labels', []):
        labels[label['id']] = {
            'name': label['name'],
            'color': label['color']
        }
    
    # Extract lists
    lists_map = {}
    for list_item in data.get('lists', []):
        lists_map[list_item['id']] = list_item['name']
    
    list_names = list(lists_map.values())
    
    # Extract checklists
    checklists_map = {}
    for checklist in data.get('checklists', []):
        checklists_map[checklist['id']] = checklist
    
    # Extract cards
    cards = []
    for card_data in data.get('cards', []):
        if not card_data.get('closed', False):  # Skip archived cards
            
            # Get card labels
            card_labels = []
            for label in card_data.get('labels', []):
                card_labels.append(label['id'])
            
            # Get card checklists
            card_checklists = []
            for checklist_id in card_data.get('idChecklists', []):
                if checklist_id in checklists_map:
                    card_checklists.append(checklists_map[checklist_id])
            
            card = TrelloCard(
                id=card_data['id'],
                name=card_data['name'],
                desc=card_data.get('desc', ''),
                list_name=lists_map.get(card_data['idList'], 'Unknown'),
                labels=card_labels,
                closed=card_data.get('closed', False),
                due_complete=card_data.get('dueComplete', False),
                checklists=card_checklists,
                url=card_data.get('url', '')
            )
            cards.append(card)
    
    return labels, cards, list_names

def main():
    parser = argparse.ArgumentParser(description='Migrate Trello board to GitHub Issues and Project Board')
    parser.add_argument('--token', required=True, help='GitHub personal access token')
    parser.add_argument('--owner', required=True, help='GitHub repository owner')
    parser.add_argument('--repo', required=True, help='GitHub repository name')
    parser.add_argument('--trello-file', default='frontend/src/trello.json', help='Path to Trello JSON file')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without actually creating')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.trello_file):
        print(f"❌ Trello file not found: {args.trello_file}")
        return
    
    # Parse Trello data
    print("📊 Parsing Trello data...")
    labels, cards, list_names = parse_trello_data(args.trello_file)
    
    print(f"Found {len(labels)} labels, {len(cards)} cards, {len(list_names)} lists")
    
    if args.dry_run:
        print("\n🔍 DRY RUN MODE - showing what would be created:")
        print("\nLabels to create:")
        for label_id, label_data in labels.items():
            if label_data['name']:
                print(f"  - {label_data['name']} ({label_data['color']})")
        
        print(f"\nProject board columns:")
        for list_name in list_names:
            print(f"  - {list_name}")
        
        print(f"\nIssues to create:")
        for card in cards:
            status = "✅ CLOSED" if card.due_complete else "🔄 OPEN"
            label_names = [labels.get(l, {}).get('name', 'Unknown') for l in card.labels if labels.get(l, {}).get('name')]
            print(f"  - [{status}] {card.name} ({card.list_name}) - Labels: {', '.join(label_names)}")
        
        return
    
    # Initialize GitHub migrator
    config = GitHubConfig(
        token=args.token,
        owner=args.owner,
        repo=args.repo
    )
    
    migrator = GitHubMigrator(config)
    
    # Create labels
    print("\n🏷️  Creating GitHub labels...")
    label_mapping = migrator.create_github_labels(labels)
    
    # Create project board
    print("\n📋 Creating project board...")
    board_name = "Portfolio Backlog"
    project_id = migrator.create_project_board(board_name, list_names)
    
    # Create issues
    print("\n📝 Creating GitHub issues...")
    for i, card in enumerate(cards):
        issue_number = migrator.create_github_issue(card, label_mapping)
        if issue_number:
            migrator.created_issues[card.id] = issue_number
        
        # Rate limiting
        if (i + 1) % 10 == 0:
            print(f"   Pausing for rate limiting... ({i + 1}/{len(cards)})")
            time.sleep(2)
    
    print(f"\n✅ Migration completed!")
    print(f"   Created {len(migrator.created_issues)} issues")
    print(f"   Project board ID: {project_id}")
    print(f"\n🔗 View your project at: https://github.com/{args.owner}/{args.repo}/projects")

if __name__ == "__main__":
    main() 