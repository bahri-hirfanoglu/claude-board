// Run: GITHUB_TOKEN=your_token node scripts/create-release.js

const body = {
  tag_name: 'v3.0.0',
  name: 'v3.0.0 - Modular Architecture, Live Terminal & Mobile Support',
  body: `## Claude Board v3.0.0

The biggest release yet — a complete rewrite with professional architecture, two major features, and full mobile support.

### Architecture Overhaul
- **Backend**: Modular src/ structure — db/ (6 files), claude/ (3 files), routes/ (3 files)
- **Frontend**: Feature-based organization — features/, hooks/, lib/, app/
- **App.jsx**: Decomposed 579-line god component into slim shell + 5 custom hooks + layout

### New Features
- **Live Terminal** — Real-time Claude output with grouped tool calls, edit diffs, turn separators, markdown rendering
- **Task Queue & Auto-Chain** — Enable auto-queue per project for sequential task execution
- **Activity Timeline** — Chronological event feed with date grouping and type icons
- **Review System** — Approve or request changes with revision context
- **Claude Usage Dashboard** — Token stats, model breakdown, cost analysis, 30-day sparkline, rate limit status
- **Live Token Tracking** — Real-time token updates on every turn, persisted to DB

### Mobile Support
- Kanban board with tab-based column switching
- Full-screen overlay panels on mobile
- Compact header with progressive disclosure

### Stability
- shell:false for Claude CLI (fixes prompt truncation)
- Correct stream-json event parsing
- Debounced DB saves, graceful shutdown

### Open Source
- README with screenshots and animated demo GIF
- Dockerfile + docker-compose.yml
- MIT License, CONTRIBUTING.md, CHANGELOG.md

**Full Changelog**: https://github.com/bahri-hirfanoglu/claude-board/commits/v3.0.0`,
  draft: false,
  prerelease: false
};

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log('No GITHUB_TOKEN found. Create release manually:');
  console.log('https://github.com/bahri-hirfanoglu/claude-board/releases/new?tag=v3.0.0');
  process.exit(0);
}

fetch('https://api.github.com/repos/bahri-hirfanoglu/claude-board/releases', {
  method: 'POST',
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json',
  },
  body: JSON.stringify(body)
}).then(r => r.json()).then(d => {
  if (d.html_url) console.log('Release created:', d.html_url);
  else console.log('Error:', d.message);
});
