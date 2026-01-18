# E2B Sandbox Implementation - Phased Approach

## Core Architecture Principle

**Single Source of Truth: Convex Database**

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Agent     │────────▶│   Convex    │────────▶│  E2B Sandbox│
│  (Future)   │  Edit   │  (Database) │  Sync   │  (Runtime)  │
└─────────────┘         └─────────────┘         └─────────────┘
                               ▲                        │
                               │                        │
                               │  Edit                  │
                        ┌──────┴──────┐                 │
                        │    User     │                 │
                        │  (Monaco)   │                 │
                        └─────────────┘                 │
                               ▲                        │
                               │                        │
                               └────────Preview─────────┘
```

**Key Flow:**
1. **Edit** (User or Agent) → Update Convex files table
2. **Convex** → Trigger sync to E2B sandbox
3. **E2B** → HMR updates preview
4. **Preview** → User sees changes

---

## Phase 1: Template Cloning & Basic Sandbox

**Goal:** Send first message → Template clones → Sandbox created → npm install → Files ready

**No editing, no dev server yet - just prove sandbox works**

### 1.1: GitHub Template Cloning
**File:** `convex/templates.ts`

- Fetch file tree from `https://github.com/aadithya2112/code-agent-react-starter`
- Download raw content for each file
- Filter text files only (skip binaries, node_modules, .git)
- Return `Array<{path: string, content: string}>`

### 1.2: Project Initialization
**File:** `convex/projects.ts`

- Add `initializeProjectWithTemplate` action
- Calls `cloneTemplate`
- Batch inserts files into `files` table
- All files get `version: 1`

### 1.3: E2B Sandbox Creation
**File:** `convex/sandbox.ts`

Install: `cd convex && bun add @e2b/code-interpreter`

Actions:
- `createSandbox(projectId)` - Spin up, write files, npm install
- `destroySandbox(sandboxId)` - Kill sandbox

### 1.4: Update Message Handler
**File:** `app/project/[id]/page.tsx`

On first message: call `initializeProjectWithTemplate`

### 1.5: Auto-create Sandbox on Mount
**File:** `app/project/[id]/page.tsx`

useEffect: When files exist → create sandbox

---

## Phase 2: Dev Server & Preview

**Goal:** Click Start → npm run dev → Preview URL appears

### 2.1: Start/Stop Actions
**File:** `convex/sandbox.ts`

- `startDevServer(sandboxId)` - Run npm run dev, return URL
- `stopDevServer(sandboxId)` - Kill process

### 2.2: Wire Buttons
**File:** `app/project/[id]/page.tsx`

- handleStart → startDevServer → setPreviewUrl
- handleStop → stopDevServer → clear preview

### 2.3: Update Preview Panel
**File:** `components/PreviewPanel.tsx`

Show iframe when previewUrl exists

---

## Phase 3: Monaco Editor & File Sync

**Goal:** Edit file → Convex updates → E2B syncs → Preview refreshes

### 3.1: Install Monaco
```bash
bun add @monaco-editor/react
```

### 3.2: Create Editor Component
**File:** `components/MonacoEditor.tsx`

- Debounced onChange (300ms)
- Syntax highlighting

### 3.3: Update Code Panel
**File:** `components/CodePanel.tsx`

Add Monaco editor to right side of file tree

### 3.4: File Sync Action
**File:** `convex/sandbox.ts`

`syncFileToSandbox(sandboxId, path, content)` - Write to E2B

### 3.5: Edit Handler
**File:** `app/project/[id]/page.tsx`

```typescript
handleFileEdit = async (path, content) => {
  await updateFile({ projectId, path, content })
  await syncFileToSandbox({ sandboxId, path, content })
}
```

---

## Phase 4: Sync Queue (Prevent Race Conditions)

**Goal:** Handle rapid edits safely

### 4.1: Queue Manager
**File:** `lib/fileSyncQueue.ts`

Sequential queue that processes:
1. Update Convex
2. Sync to E2B
3. Next item

### 4.2: Use in Editor
**File:** `hooks/useFileEdit.ts`

All edits go through queue

---

## Phase 5: Agent Integration (Future)

Agent uses same flow:
- Calls `updateFile` mutation
- Queue handles sync automatically
- No special handling needed

---

## Implementation Order

### NOW (Phase 1)
1. Create templates.ts with GitHub cloning
2. Create sandbox.ts with E2B integration
3. Add initializeProjectWithTemplate
4. Update message handler
5. Add sandbox auto-creation

### NEXT (Phase 2)
1. Add start/stop dev server
2. Wire buttons
3. Update preview panel

### LATER (Phase 3-4)
1. Monaco editor
2. File sync
3. Sync queue

---

## Critical Decisions

1. **Convex = Source of Truth** - All edits go here first
2. **Sequential Queue** - One sync at a time, no conflicts
3. **Version Numbers** - Detect conflicts
4. **Hardcoded Template** - One template for now

---

## Testing Checklist

Phase 1:
- [ ] Template clones successfully
- [ ] Files in Convex with correct paths
- [ ] Sandbox creates
- [ ] npm install completes

Phase 2:
- [ ] Start runs dev server
- [ ] Preview URL works
- [ ] Stop kills server

Phase 3:
- [ ] Monaco loads file
- [ ] Edit updates Convex
- [ ] Edit syncs to E2B
- [ ] Preview refreshes

---

Ready to implement Phase 1!
