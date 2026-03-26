---
title: "Prompt Templates"
description: "Customize Claude's system prompt per task type"
icon: "file-code"
---

Prompt templates let you define reusable instructions that are automatically injected into Claude's system prompt when executing tasks. Use them to enforce coding standards, framework patterns, and quality guidelines.

## How It Works

<Steps>
  <Step title="Create a template" icon="plus">
    Go to **Project > Templates** and create a new prompt template.
  </Step>
  <Step title="Set the task type" icon="tag">
    Assign the template to a task type (`feature`, `bugfix`, `refactor`, etc.). All tasks of that type will automatically use this template.
  </Step>
  <Step title="Write instructions" icon="pen">
    Write your template content with optional `{{variable}}` placeholders for dynamic values.
  </Step>
  <Step title="Automatic injection" icon="bolt">
    When a matching task runs, the template is injected into Claude's prompt — no manual action needed.
  </Step>
</Steps>

## Template Matching

Templates are matched by **task_type**:

| Template Type | Applies To |
|---------------|-----------|
| `feature` | All feature tasks in the project |
| `bugfix` | All bugfix tasks |
| `refactor` | All refactor tasks |
| `test` | All test tasks |
| `docs` | All documentation tasks |
| `chore` | All chore tasks |

If no matching template exists, the default prompt is used without additional instructions.

## Template Variables

Use `{{variable_name}}` syntax for dynamic placeholders:

```
Review the {{component}} module for {{issue_type}} issues.
Focus on {{specific_area}} and ensure {{quality_criteria}}.
```

Variables are filled in when creating a task from the template selector in the task creation modal.

## Prompt Injection Order

Templates are injected with high priority in Claude's attention:

```
1. Role instructions (if a role is assigned)
2. Prompt Template content ← your template goes here
3. Context snippets
4. Task title & description
5. File attachments
```

<Info>Templates appear before the task details, so Claude treats them as high-priority instructions that shape how the task is executed.</Info>

## Example Templates

<Tabs>
  <Tab title="Code Standards">
    ```
    You are working on a TypeScript project using strict mode.
    - Always use `const` over `let` unless reassignment is needed
    - Prefer named exports over default exports
    - Use Zod for runtime validation at API boundaries
    - Write JSDoc comments for public functions
    ```
  </Tab>
  <Tab title="Framework">
    ```
    This is a Next.js 14 application using the App Router.
    - Use Server Components by default, Client Components only when needed
    - Data fetching should use server actions or route handlers
    - Styles use Tailwind CSS with the project's design tokens in tailwind.config.ts
    ```
  </Tab>
  <Tab title="Testing">
    ```
    Write tests using Vitest with React Testing Library.
    - Test behavior, not implementation details
    - Use `screen.getByRole` over `getByTestId` when possible
    - Mock external APIs with MSW (Mock Service Worker)
    - Aim for >80% coverage on new code
    ```
  </Tab>
  <Tab title="Security Review">
    ```
    Review this code with a security focus. Check for:
    - SQL injection (use parameterized queries)
    - XSS (sanitize user input, escape output)
    - Missing authentication/authorization checks
    - Hardcoded secrets or credentials
    - Insecure deserialization
    Report findings as inline code comments.
    ```
  </Tab>
</Tabs>
