import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const getFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // No auth check - this is for internal use by actions
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
    return files
  },
})

export const getProjectFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // Verify project access
    const project = await ctx.db.get(args.projectId)
    if (!project) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) return []

    // Get all files for this project
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    return files
  },
})

export const getFile = query({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    // Verify project access
    const project = await ctx.db.get(args.projectId)
    if (!project) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) return null

    // Get file
    const file = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path),
      )
      .first()

    return file
  },
})

export const updateFile = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Verify project access
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error("Project not found")

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized")
    }

    // Find existing file
    const existingFile = await ctx.db
      .query("files")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.path),
      )
      .first()

    const now = Date.now()

    if (existingFile) {
      // Update existing file and increment version
      await ctx.db.patch(existingFile._id, {
        content: args.content,
        version: existingFile.version + 1,
        lastModified: now,
      })

      // Update project lastModified
      await ctx.db.patch(args.projectId, {
        lastModified: now,
      })

      return { fileId: existingFile._id, version: existingFile.version + 1 }
    } else {
      // Create new file
      const fileId = await ctx.db.insert("files", {
        projectId: args.projectId,
        path: args.path,
        content: args.content,
        version: 1,
        lastModified: now,
      })

      // Update project lastModified
      await ctx.db.patch(args.projectId, {
        lastModified: now,
      })

      return { fileId, version: 1 }
    }
  },
})

export const createFiles = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Verify project access
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error("Project not found")

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first()

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized")
    }

    const now = Date.now()
    const fileIds = []

    // Insert all files
    for (const file of args.files) {
      const fileId = await ctx.db.insert("files", {
        projectId: args.projectId,
        path: file.path,
        content: file.content,
        version: 1,
        lastModified: now,
      })
      fileIds.push(fileId)
    }

    // Update project lastModified
    await ctx.db.patch(args.projectId, {
      lastModified: now,
    })

    return fileIds
  },
})
