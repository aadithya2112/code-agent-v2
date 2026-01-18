import { v } from "convex/values"
import { action, mutation, query } from "./_generated/server"
import { api } from "./_generated/api"

export const getProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // Get or create user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) return []

    // Get all projects for this user
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()

    return projects
  },
})

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const project = await ctx.db.get(args.projectId)
    if (!project) return null

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) return null

    return project
  },
})

export const createEmptyProject = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkUserId: identity.subject,
        email: identity.email || "",
        createdAt: Date.now(),
      })
      user = await ctx.db.get(userId)
      if (!user) throw new Error("Failed to create user")
    }

    // Create project with default values
    const projectId = await ctx.db.insert("projects", {
      userId: user._id,
      name: "Untitled Project",
      framework: "react",
      templateUrl:
        "https://github.com/facebook/react/tree/main/fixtures/packaging/babel-standalone/dev",
      createdAt: Date.now(),
      lastModified: Date.now(),
    })

    return projectId
  },
})

export const updateProjectFromMessage = mutation({
  args: {
    projectId: v.id("projects"),
    userMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error("Project not found")

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized")
    }

    // Auto-detect framework from message (simple keyword matching)
    const messageLower = args.userMessage.toLowerCase()
    const isNextJs =
      messageLower.includes("next.js") ||
      messageLower.includes("nextjs") ||
      messageLower.includes("routing") ||
      messageLower.includes("ssr") ||
      messageLower.includes("server side")
    const framework = isNextJs ? "nextjs" : "react"

    // Generate project name from first few words of message (only if still untitled)
    const shouldUpdateName = project.name === "Untitled Project"
    const name = shouldUpdateName
      ? args.userMessage
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(" ")
          .slice(0, 50) || "New Project"
      : project.name

    // Update project
    await ctx.db.patch(args.projectId, {
      name,
      framework,
      lastModified: Date.now(),
    })
  },
})

export const createProject = mutation({
  args: {
    name: v.string(),
    framework: v.union(v.literal("react"), v.literal("nextjs")),
    templateUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkUserId: identity.subject,
        email: identity.email || "",
        createdAt: Date.now(),
      })
      user = await ctx.db.get(userId)
      if (!user) throw new Error("Failed to create user")
    }

    // Create project
    const projectId = await ctx.db.insert("projects", {
      userId: user._id,
      name: args.name,
      framework: args.framework,
      templateUrl: args.templateUrl,
      createdAt: Date.now(),
      lastModified: Date.now(),
    })

    return projectId
  },
})

export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error("Project not found")

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized")
    }

    // Delete all files
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const file of files) {
      await ctx.db.delete(file._id)
    }

    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    for (const message of messages) {
      await ctx.db.delete(message._id)
    }

    // Delete project
    await ctx.db.delete(args.projectId)
  },
})

export const updateProjectName = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error("Project not found")

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized")
    }

    await ctx.db.patch(args.projectId, {
      name: args.name,
      lastModified: Date.now(),
    })
  },
})

export const updateSandboxId = mutation({
  args: {
    projectId: v.id("projects"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      sandboxId: args.sandboxId,
      lastModified: Date.now(),
    })
  },
})

export const updateDevServerUrl = mutation({
  args: {
    projectId: v.id("projects"),
    devServerUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      devServerUrl: args.devServerUrl,
      lastModified: Date.now(),
    })
  },
})

export const initializeProjectWithTemplate = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    // Clone template from GitHub
    const files = await ctx.runAction(api.templates.cloneTemplate, {})

    console.log(`Cloned ${files.length} files from template`)

    // Batch insert all files at once instead of one by one
    await ctx.runMutation(api.files.createFiles, {
      projectId,
      files: files.map((f) => ({
        path: f.path,
        content: f.content,
      })),
    })

    console.log(
      `Initialized project ${projectId} with ${files.length} template files`,
    )
  },
})
