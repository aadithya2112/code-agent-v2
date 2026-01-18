# Template Import Scripts

## Import Template from GitHub

Fetches all files from the GitHub repository and updates `convex/templates.ts` with the latest template files.

### Usage

```bash
bunx tsx scripts/import-template.ts
```

### What it does

1. Fetches file tree from `aadithya2112/code-agent-react-starter` repository
2. Downloads all text files (excluding node_modules, .git, binaries, etc.)
3. Generates new `convex/templates.ts` with all files as static template
4. No runtime GitHub API calls needed - all files are embedded in the code

### When to run

- When setting up the project for the first time
- After making changes to the GitHub starter template repository
- To sync new shadcn components or configuration updates

### Configuration

Edit these constants in `import-template.ts` to use a different repository:

```typescript
const REPO_OWNER = "aadithya2112"
const REPO_NAME = "code-agent-react-starter"
const BRANCH = "main"
```

### Output

- Updates: `convex/templates.ts`
- File size: ~190KB (68 files)
- All files are embedded as template strings
- Commit the updated file to version control
