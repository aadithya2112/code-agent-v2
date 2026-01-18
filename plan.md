# Plan: Build Coding Agent Platform (MVP)

A Next.js + Convex application enabling users to create React/Next.js projects, edit code in-browser, and preview in E2B sandboxes with real-time synchronization. Uses Clerk for auth, Monaco for editing, and focuses on infrastructure before agent orchestration.

## Architecture Overview

**Frontend:** Next.js 16 (App Router)  
**Backend:** Convex (database + server functions + real-time sync)  
**Auth:** Clerk  
**Sandbox:** E2B  
**Editor:** Monaco Editor  
**AI Components:** ai-elements@latest (TBD based on needs)  
**Package Manager:** Bun

**No separate backend needed** - Convex handles all server-side logic, database, real-time subscriptions, and external API calls (E2B, GitHub).

---

## Current Status

✅ **Completed:**

- Next.js 16 project initialized
- Clerk authentication installed
- Convex installed
- Using Bun as package manager

🔄 **Next Steps:** Follow steps below

---

## Steps

### 1. Configure Clerk authentication and create route structure

- Set up Clerk middleware for protected routes
- Configure Clerk environment variables in `.env.local`
- Create route structure:
  - `/` - Landing/login page
  - `/dashboard` - User's projects list
  - `/project/[id]` - Project view with editor + preview
- Create basic layout components with Clerk provider

**Files:** [middleware.ts](middleware.ts), [app/layout.tsx](app/layout.tsx), [app/page.tsx](app/page.tsx), [app/dashboard/page.tsx](app/dashboard/page.tsx), [app/project/[id]/page.tsx](app/project/[id]/page.tsx)

---

### 2. Set up Convex backend with schema and functions

**Schema design:**

- `users` table: `clerkUserId`, `email`, `createdAt`
- `projects` table: `userId`, `name`, `framework` (react/nextjs), `templateUrl`, `createdAt`, `lastModified`
- `messages` table: `projectId`, `role` (user/assistant), `content`, `createdAt`
- `files` table: `projectId`, `path`, `content`, `version`, `lastModified` (version field critical for race condition prevention)

**Convex functions to implement:**

- **Queries:** `getProjects`, `getProject`, `getProjectFiles`, `getMessages`
- **Mutations:** `createProject`, `updateFile`, `createMessage`, `deleteProject`
- **Actions:** `cloneTemplate`, `createSandbox`, `destroySandbox`, `syncFilesToSandbox`

**Files:** [convex/schema.ts](convex/schema.ts), [convex/projects.ts](convex/projects.ts), [convex/files.ts](convex/files.ts), [convex/messages.ts](convex/messages.ts), [convex/sandbox.ts](convex/sandbox.ts)

---

### 3. Install remaining dependencies

- Install Monaco Editor: `bun add @monaco-editor/react`
- Install E2B SDK (in Convex): Will be configured in convex package.json
- Install additional UI dependencies as needed

---

### 4. Build project creation and GitHub template cloning flow

- Create UI for project creation (modal/form in dashboard)
- User selects framework (React/Next.js) and provides template URL
- Convex action: clone GitHub repo (using GitHub API or simple fetch)
- Parse template files and store in `files` table with initial version = 1
- Store project metadata in `projects` table
- Redirect to project view page

**Implementation notes:**

- Use Convex action to fetch template from GitHub (public repos via raw.githubusercontent.com or GitHub API)
- Recursively traverse directory structure
- Insert all files into `files` table with `projectId`, `path`, `content`, `version: 1`

**Files:** [components/CreateProjectModal.tsx](components/CreateProjectModal.tsx), [convex/templates.ts](convex/templates.ts)

---

### 5. Implement E2B sandbox lifecycle management

**Lifecycle:**

- **Create:** When user navigates to `/project/[id]` page
- **Destroy:** When user navigates away or closes tab (useEffect cleanup)

**Convex action workflow:**

1. `createSandbox(projectId)`:
   - Spin up E2B sandbox
   - Fetch all files from `files` table for this project
   - Write files to sandbox filesystem
   - Run `bun install` (or npm install depending on template)
   - Run `bun run dev` (or npm run dev) in background
   - Store sandbox ID in Convex (ephemeral, not persisted in table - return to client)
   - Return preview URL

2. `syncFilesToSandbox(sandboxId, filePath, content)`:
   - Write single file to E2B sandbox filesystem
   - Trigger HMR if dev server supports it

3. `destroySandbox(sandboxId)`:
   - Kill sandbox instance

**Race condition prevention:**

- Client maintains single WebSocket connection to Convex
- File edits trigger mutation first (Convex is source of truth)
- After mutation succeeds, call action to sync to E2B
- Use sequential queue on client to ensure file writes don't overlap

**Files:** [convex/sandbox.ts](convex/sandbox.ts), [hooks/useSandbox.ts](hooks/useSandbox.ts)

---

### 6. Build Monaco editor with file tree and real-time sync

**Components:**

- `FileTree` - Renders project files from Convex query with real-time updates
- `MonacoEditor` - Code editor with syntax highlighting and onChange handler
- File selection state management

**File sync flow (CRITICAL - prevents race conditions):**

1. User types in Monaco editor
2. Debounce onChange (300ms to avoid excessive writes)
3. Call Convex mutation: `updateFile(projectId, filePath, newContent)`
   - Increment `version` field atomically
   - Update `content` and `lastModified`
4. After mutation succeeds, call Convex action: `syncFilesToSandbox(sandboxId, filePath, newContent)`
5. E2B writes file and triggers HMR

**Important:**

- No optimistic updates - editor reflects Convex state via real-time subscription
- Use `version` field to detect conflicts (if multiple writes somehow happen)
- Queue file sync operations on client side (process one at a time)

**Files:** [components/FileTree.tsx](components/FileTree.tsx), [components/MonacoEditor.tsx](components/MonacoEditor.tsx), [hooks/useFileSync.ts](hooks/useFileSync.ts)

---

### 7. Create project view page with split layout

**Layout (3-column):**

- **Left (20%):** File tree with project files
- **Center (40%):** Monaco editor showing selected file
- **Right (40%):** E2B preview iframe

**Page logic:**

1. On mount: Create E2B sandbox, show loading state
2. Once sandbox ready: Display preview URL in iframe
3. On unmount/navigation: Destroy sandbox immediately
4. Handle sandbox failures gracefully

**Files:** [app/project/[id]/page.tsx](app/project/[id]/page.tsx), [components/ProjectLayout.tsx](components/ProjectLayout.tsx), [components/PreviewPane.tsx](components/PreviewPane.tsx)

---

## Implementation Considerations

### 1. Race Condition Prevention (CRITICAL)

**Strategy: Sequential Write Queue + Version Control**

- **Convex as single source of truth** - No optimistic updates
- File mutations increment `version` field atomically in Convex
- Client-side queue ensures E2B sync calls happen sequentially
- Debounce editor onChange (300ms) to reduce write frequency
- If E2B sync fails, retry up to 3 times, then show error (Convex still has correct state)

**Implementation:**

```typescript
// Client-side queue manager
class FileSyncQueue {
  private queue: Array<{ filePath: string; content: string }> = []
  private processing = false

  async enqueue(filePath: string, content: string) {
    // 1. First, update Convex (source of truth)
    await convex.mutation(api.files.updateFile, {
      projectId,
      filePath,
      content,
    })

    // 2. Then, queue E2B sync
    this.queue.push({ filePath, content })
    this.processQueue()
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const { filePath, content } = this.queue.shift()!
      await convex.action(api.sandbox.syncFilesToSandbox, {
        sandboxId,
        filePath,
        content,
      })
    }

    this.processing = false
  }
}
```

---

### 2. File Storage in Convex

- Store all code files as text in `files` table `content` field
- Convex documents support up to 1MB per document (sufficient for code files)
- For images/assets in templates: Consider Convex File Storage or exclude from initial clone
- **Suggested approach:** Start with text files only, add binary file support later if needed

---

### 3. Error Handling

**E2B Sandbox Failures:**

- **Timeout (bun/npm install > 2 min):** Show error in preview pane with retry button
- **Memory/CPU limits:** Display error message, suggest simpler template or restart sandbox
- **Install errors:** Parse error output, show in preview pane with collapsible details
- **Dev server crash:** Auto-retry once, then show error with manual restart button
- **Network issues:** Retry E2B API calls with exponential backoff (3 attempts)

**UI/UX:**

- Preview pane has 3 states: Loading, Running (iframe), Error
- Error state shows user-friendly message + technical details (collapsible)
- All errors logged to console for debugging

**Suggested implementation:**

- Create `PreviewPane` component with error boundary
- Sandbox status stored in React state: `'initializing' | 'running' | 'error' | 'destroyed'`
- Display appropriate UI for each state

---

### 4. Template Storage

**Suggested approach: Environment Variables + Convex Config**

**Option A (Recommended):**

- Store default template URLs in `.env.local`:
  ```
  NEXT_PUBLIC_REACT_TEMPLATE_URL=https://github.com/user/react-template
  NEXT_PUBLIC_NEXTJS_TEMPLATE_URL=https://github.com/user/nextjs-template
  ```
- Sync to Convex environment variables
- Users can also provide custom template URLs when creating projects

**Option B:**

- Hardcode in Convex action with ability to override:
  ```typescript
  const DEFAULT_TEMPLATES = {
    react: "https://github.com/user/react-template",
    nextjs: "https://github.com/user/nextjs-template",
  }
  ```

**Recommendation:** Use Option A for flexibility. You can easily swap templates without code changes.

---

## Dependencies Status

### ✅ Already Installed:

```bash
@clerk/nextjs
convex
next (v16)
react
```

### 🔄 To Install (using Bun):

**Frontend:**

```bash
bun add @monaco-editor/react
bun add ai-elements  # When needed
```

**Convex Backend:**

```bash
# In convex/ directory
bun add @e2b/sdk
```

---

## Environment Variables Required

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# E2B
E2B_API_KEY=

# Templates (optional)
NEXT_PUBLIC_REACT_TEMPLATE_URL=
NEXT_PUBLIC_NEXTJS_TEMPLATE_URL=
```

---

## File Structure

```
code-agent-v2/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing page
│   ├── dashboard/
│   │   └── page.tsx                # Projects list
│   └── project/
│       └── [id]/
│           └── page.tsx            # Project editor view
├── components/
│   ├── CreateProjectModal.tsx
│   ├── FileTree.tsx
│   ├── MonacoEditor.tsx
│   ├── PreviewPane.tsx
│   └── ProjectLayout.tsx
├── convex/
│   ├── schema.ts
│   ├── projects.ts                 # Queries/mutations for projects
│   ├── files.ts                    # Queries/mutations for files
│   ├── messages.ts                 # Queries/mutations for messages
│   ├── templates.ts                # Actions for cloning templates
│   └── sandbox.ts                  # Actions for E2B management
├── hooks/
│   ├── useSandbox.ts
│   └── useFileSync.ts
├── lib/
│   └── fileSyncQueue.ts            # Queue manager for race prevention
├── middleware.ts                   # Clerk auth middleware
├── .env.local
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## Implementation Stages & Verification

### Stage 1: Foundation & Authentication (Day 1)

**Tasks:**

1. Configure Clerk middleware and environment variables
2. Set up protected routes structure
3. Create basic layout with Clerk provider
4. Build landing page with sign-in/sign-up

**Verification:**

- [ ] User can sign in/sign up via Clerk
- [ ] Unauthenticated users are redirected to landing page
- [ ] Authenticated users can access /dashboard
- [ ] Clerk session persists across page refreshes

**Files:** `proxy.ts`, `app/layout.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`

---

### Stage 2: Convex Backend Setup (Day 1-2)

**Tasks:**

1. Initialize Convex (`bunx convex dev`)
2. Define schema for users, projects, files, messages
3. Implement basic queries and mutations
4. Test Convex real-time subscriptions

**Verification:**

- [ ] Convex dev server runs without errors
- [ ] Schema validates correctly
- [ ] Can create/read/update/delete projects via Convex dashboard
- [ ] Real-time subscriptions work (test with useQuery hook)
- [ ] Clerk userId correctly syncs to Convex users table

**Files:** `convex/schema.ts`, `convex/projects.ts`, `convex/files.ts`, `convex/messages.ts`

**Test Cases:**

```typescript
// Test 1: Create project and verify in DB
await createProject({ name: "Test", framework: "react", templateUrl: "..." })
// Verify: Project appears in getProjects query

// Test 2: File versioning
await updateFile({ projectId, path: "App.tsx", content: "v1" })
await updateFile({ projectId, path: "App.tsx", content: "v2" })
// Verify: File version increments to 2

// Test 3: Real-time updates
// Open two browser tabs, edit file in tab 1, verify tab 2 updates
```

---

### Stage 3: Dashboard & Project Creation UI (Day 2)

**Tasks:**

1. Build dashboard page showing user's projects
2. Create "New Project" modal with form
3. Implement project creation flow (without template cloning yet)
4. Add project deletion

**Verification:**

- [ ] Dashboard displays all user projects
- [ ] Can create new project via modal
- [ ] New project appears in dashboard immediately (real-time)
- [ ] Can delete project
- [ ] Project list updates in real-time across tabs

**Files:** `app/dashboard/page.tsx`, `components/CreateProjectModal.tsx`

---

### Stage 4: GitHub Template Cloning (Day 2-3)

**Tasks:**

1. Implement Convex action to fetch GitHub repo contents
2. Parse directory structure recursively
3. Store all text files in Convex files table
4. Handle errors (invalid URL, private repos, API limits)

**Verification:**

- [ ] Can clone public GitHub repository
- [ ] All files stored correctly with proper paths
- [ ] Directory structure preserved (nested folders)
- [ ] Binary files are skipped or handled gracefully
- [ ] Error handling works for invalid/private repos

**Files:** `convex/templates.ts`

**Test Cases:**

```typescript
// Test 1: Clone simple React template
templateUrl = "https://github.com/user/simple-react-template"
// Verify: All .js/.tsx/.json files in DB with correct paths

// Test 2: Nested directories
// Template has src/components/Button/index.tsx
// Verify: Path stored as "src/components/Button/index.tsx"

// Test 3: Large files (>100KB)
// Verify: Files stored without truncation

// Test 4: Invalid URL
templateUrl = "https://github.com/fake/repo"
// Verify: Error thrown with helpful message
```

---

### Stage 5: E2B Sandbox Integration (Day 3-4) **CRITICAL**

**Tasks:**

1. Install E2B SDK in Convex
2. Implement createSandbox action
3. Implement destroySandbox action
4. Test sandbox lifecycle (create -> write files -> run dev -> destroy)

**Verification:**

- [ ] Sandbox spins up successfully
- [ ] Files written to sandbox filesystem
- [ ] `bun install` runs without timeout
- [ ] Dev server starts and returns preview URL
- [ ] Preview URL is accessible
- [ ] Sandbox destroyed on cleanup
- [ ] Multiple sandboxes can be created simultaneously

**Files:** `convex/sandbox.ts`

**Test Cases:**

```typescript
// Test 1: Basic lifecycle
const { sandboxId, previewUrl } = await createSandbox({ projectId })
// Verify: Sandbox running, preview URL loads

await destroySandbox({ sandboxId })
// Verify: Sandbox terminated, preview URL 404

// Test 2: File sync
await createSandbox({ projectId })
await syncFilesToSandbox({ sandboxId, path: "App.tsx", content: "NEW" })
// Verify: File updated in sandbox, HMR triggers

// Test 3: Install timeout
// Template with 100+ dependencies
// Verify: Timeout after 2 minutes, error returned

// Test 4: Race condition - multiple file writes
await Promise.all([
  syncFilesToSandbox({ sandboxId, path: "A.tsx", content: "1" }),
  syncFilesToSandbox({ sandboxId, path: "B.tsx", content: "2" }),
  syncFilesToSandbox({ sandboxId, path: "C.tsx", content: "3" }),
])
// Verify: All files written correctly, no corruption
```

---

### Stage 6: Monaco Editor & File Tree (Day 4-5)

**Tasks:**

1. Install Monaco Editor
2. Build file tree component (recursive rendering)
3. Integrate Monaco with file selection
4. Add syntax highlighting for different languages
5. Implement file tree expand/collapse

**Verification:**

- [ ] File tree displays all project files
- [ ] Clicking file loads content in Monaco
- [ ] Syntax highlighting works (JS, TS, CSS, JSON)
- [ ] File tree shows folder structure correctly
- [ ] Can navigate between files

**Files:** `components/FileTree.tsx`, `components/MonacoEditor.tsx`

---

### Stage 7: File Sync Queue (Day 5-6) **CRITICAL**

**Tasks:**

1. Implement FileSyncQueue class
2. Add debouncing to Monaco onChange
3. Connect editor -> Convex mutation -> E2B action
4. Test race condition prevention

**Verification:**

- [ ] Typing in editor triggers debounced updates
- [ ] Convex mutation executes before E2B sync
- [ ] File version increments correctly
- [ ] E2B sandbox receives updates
- [ ] Preview updates via HMR
- [ ] No race conditions when typing quickly

**Files:** `lib/fileSyncQueue.ts`, `hooks/useFileSync.ts`

**Test Cases (CRITICAL):**

```typescript
// Test 1: Sequential edits
// Type "A", wait 300ms, type "B", wait 300ms
// Verify: 2 mutations, 2 E2B syncs, version = 2

// Test 2: Rapid typing (race condition test)
// Type "ABCDEFGH" rapidly (< 50ms between chars)
// Verify: Only 1 mutation after debounce, version = 1, E2B has "ABCDEFGH"

// Test 3: Multiple files rapid switching
// Edit file1, immediately switch to file2, edit file2
// Verify: Both files saved correctly, no data loss

// Test 4: E2B sync failure recovery
// Mock E2B API to fail once, then succeed
// Verify: Retry logic works, file eventually synced

// Test 5: Edit during E2B sync
// Start editing file A, while E2B is syncing, edit file B
// Verify: Queue processes both in order, no corruption

// Test 6: Offline mode
// Disconnect E2B (mock network failure)
// Edit files in editor
// Verify: Convex still updates, E2B syncs queued, resume when online
```

---

### Stage 8: Project View Integration (Day 6-7)

**Tasks:**

1. Build project page layout (3-column)
2. Integrate file tree, Monaco, and preview pane
3. Implement sandbox lifecycle hooks
4. Add loading/error states
5. Handle navigation away (cleanup sandbox)

**Verification:**

- [ ] All three panes render correctly
- [ ] Sandbox creates on page load
- [ ] Preview iframe displays running app
- [ ] Can edit files and see changes in preview
- [ ] Sandbox destroys on navigation away
- [ ] Loading states show during sandbox creation
- [ ] Error states display on failures

**Files:** `app/project/[id]/page.tsx`, `components/ProjectLayout.tsx`, `components/PreviewPane.tsx`, `hooks/useSandbox.ts`

**Test Cases:**

```typescript
// Test 1: Full flow
// Create project -> Navigate to project -> Edit file -> See update
// Verify: End-to-end works

// Test 2: Multiple tab handling
// Open same project in 2 tabs
// Verify: Each gets separate sandbox, edits sync via Convex

// Test 3: Browser refresh
// Load project, refresh page
// Verify: New sandbox created, old one destroyed, state restored

// Test 4: Sandbox destruction on navigation
// Navigate to project, then back to dashboard
// Verify: Sandbox terminated, no orphaned sandboxes
```

---

### Stage 9: Error Handling & Polish (Day 7)

**Tasks:**

1. Add error boundaries
2. Implement retry logic for E2B failures
3. Add user-friendly error messages
4. Add loading spinners and skeleton states
5. Test edge cases

**Verification:**

- [ ] All errors caught and displayed nicely
- [ ] Retry buttons work
- [ ] No uncaught exceptions in console
- [ ] Loading states smooth and informative

---

## Critical Test Suite

### File Synchronization Race Conditions (MOST CRITICAL)

```typescript
describe("File Sync Race Conditions", () => {
  test("Rapid edits to single file", async () => {
    // Simulate typing 100 characters in 1 second
    // Expected: 1 Convex mutation, 1 E2B sync, correct final content
  })

  test("Edit file while E2B is syncing", async () => {
    // Start E2B sync, immediately edit same file again
    // Expected: Queue waits for first sync, then syncs second
  })

  test("Switch files rapidly", async () => {
    // Edit file A, switch to B, edit B, switch to C, edit C (all < 1 second)
    // Expected: All 3 files saved correctly in Convex and E2B
  })

  test("Concurrent edits (multi-tab)", async () => {
    // Two tabs open, edit same file simultaneously
    // Expected: Version conflict detected or last write wins (define behavior)
  })

  test("E2B sync failure with pending edits", async () => {
    // Sync file A (fails), immediately edit file B
    // Expected: File A retries, file B queues, both eventually sync
  })
})
```

### Sandbox Lifecycle

```typescript
describe("E2B Sandbox Lifecycle", () => {
  test("Create and destroy", async () => {
    const sandbox = await createSandbox({ projectId })
    expect(sandbox.previewUrl).toBeDefined()
    await destroySandbox({ sandboxId: sandbox.id })
    // Expected: Preview URL returns 404
  })

  test("Cleanup on navigation", async () => {
    // Mount project page, unmount
    // Expected: useEffect cleanup destroys sandbox
  })

  test("Handle creation timeout", async () => {
    // Mock E2B to timeout during npm install
    // Expected: Error returned within 2 minutes
  })
})
```

### Template Cloning

```typescript
describe("Template Cloning", () => {
  test("Clone valid React template", async () => {
    const files = await cloneTemplate({ url: VALID_TEMPLATE })
    expect(files.length).toBeGreaterThan(0)
    expect(files.find((f) => f.path === "package.json")).toBeDefined()
  })

  test("Handle invalid repository", async () => {
    await expect(cloneTemplate({ url: "invalid" })).rejects.toThrow()
  })

  test("Preserve directory structure", async () => {
    const files = await cloneTemplate({ url: NESTED_TEMPLATE })
    expect(files.find((f) => f.path === "src/components/App.tsx")).toBeDefined()
  })
})
```

---

## Testing Strategy

**Unit Tests:**

- FileSyncQueue class logic
- Template parsing functions
- File version incrementing

**Integration Tests:**

- Convex mutations + queries
- E2B sandbox creation + file sync
- Clerk authentication flow

**E2E Tests (Manual for MVP):**

1. Sign up new user
2. Create project with template
3. Wait for sandbox to load
4. Edit multiple files rapidly
5. Verify preview updates correctly
6. Navigate away and back
7. Delete project

**Load Testing:**

- Create 10 projects simultaneously
- Edit 10 files simultaneously in one project
- Run 5 sandboxes concurrently

---

## Success Criteria

✅ **Stage 1-4:** User can create projects and see files in dashboard  
✅ **Stage 5:** Sandboxes spin up and preview React/Next.js apps  
✅ **Stage 6-7:** Can edit code and see changes in preview with NO race conditions  
✅ **Stage 8:** Full workflow works smoothly  
✅ **Stage 9:** Errors handled gracefully

**MVP is complete when:**

- User can sign in, create a project from GitHub template, edit code in Monaco, and see changes live in preview
- No race conditions in file sync (critical)
- Sandboxes clean up properly
- Basic error handling in place

---

## Next Steps After MVP

Once the infrastructure is solid:

1. Add message/chat UI for user-agent interaction
2. Implement agent orchestrator (using OpenRouter + DeepSeek)
3. Add agent capabilities: read files, edit files, run commands
4. Integrate ai-elements for chat interface
5. Add project history/versioning
6. Implement file search and multi-file editing

---

## Open Questions

1. Should we add a "Stop" button to manually stop the dev server without destroying the sandbox?
2. Do you want project sharing/collaboration features eventually, or strictly single-user?
3. For the file tree, should files be editable inline (rename/delete), or view-only for now?
4. Should we support multiple tabs/files open in the editor simultaneously?
