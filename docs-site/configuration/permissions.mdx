---
title: "Permissions"
description: "Control what tools Claude agents can use"
icon: "shield-halved"
---

Permission modes determine how Claude interacts with your system. Since Claude Board runs with `--no-input` (no interactive prompts), permission configuration is critical.

## Permission Modes

<Tabs>
  <Tab title="Auto Accept">
    Claude can use **all** tools without asking for permission. This is the most productive mode — Claude won't get stuck waiting for approval.

    ```
    claude --no-input --dangerously-skip-permissions
    ```

    <Warning>This gives Claude full access to read, write, and execute commands in your project directory. Only use on trusted codebases or sandboxed environments.</Warning>
  </Tab>
  <Tab title="Allowed Tools">
    Only the tool categories you specify are permitted. Claude can use these freely but cannot access anything else.

    ```
    claude --no-input --allowedTools "Read,Edit,Write,Bash"
    ```

    This is a good middle ground — you control the blast radius while keeping Claude autonomous.
  </Tab>
  <Tab title="Default">
    Uses Claude CLI's built-in permission system. This may cause agents to stall if they need a tool that requires interactive approval.

    <Note>Not recommended for Claude Board since `--no-input` prevents interactive permission prompts.</Note>
  </Tab>
</Tabs>

## Tool Categories

When using Allowed Tools mode, you can permit any combination of:

| Tool | What It Does |
|------|--------------|
| `Read` | Read file contents from disk |
| `Edit` | Modify existing files |
| `Write` | Create new files |
| `Bash` | Execute shell commands |
| `Glob` | Search for files by pattern |
| `Grep` | Search file contents by regex |

## Recommendations

<AccordionGroup>
  <Accordion title="Getting started">
    Use **Auto Accept** to avoid agents getting stuck. This is the fastest way to see results.
  </Accordion>
  <Accordion title="Production projects">
    Use **Allowed Tools** with `Read,Edit,Write,Bash,Glob,Grep` for full functionality with explicit control.
  </Accordion>
  <Accordion title="Read-only analysis">
    Use **Allowed Tools** with only `Read,Glob,Grep` if you want Claude to analyze code without making changes.
  </Accordion>
</AccordionGroup>
