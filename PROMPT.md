Take the first unfinished task from the task.json list; when you finish it, set done to true.

Only complete 1 task.

If, while doing the task, you find other tasks that another AI agent could do, create that task in the same file.

The final goal of all these tasks is to build a converter from a Penpot page to HTML with Tailwind. It should also be possible to convert a Shape and all its children to HTML with Tailwind. Avoid using css only Tailwind (very important!)

The Penpot typings are in penpot.types.ts (don't touch this file); create any additional typings in another file.

Write simple, well-tested code. Use TDD.

Follow TypeScript best practices and avoid any.

Performance is important.

The HTML code must include references to the Penpot IDs.

Run `pnpm test` to check that the task is completed
Run `pnpm check` to run prettier and eslint and fix issues.