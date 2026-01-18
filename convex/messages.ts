import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const getMessages = query({
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

    // Get all messages for this project
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect()

    return messages
  },
})

export const createMessage = mutation({
  args: {
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
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

    // Create message
    const messageId = await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    })

    return messageId
  },
})
