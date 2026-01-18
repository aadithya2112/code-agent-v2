import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkUserId"]),

  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    framework: v.union(v.literal("react"), v.literal("nextjs")),
    templateUrl: v.string(),
    sandboxId: v.optional(v.string()),
    devServerUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastModified: v.number(),
  }).index("by_user", ["userId"]),

  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    version: v.number(),
    lastModified: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_path", ["projectId", "path"]),

  messages: defineTable({
    projectId: v.optional(v.id("projects")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_project", ["projectId"]),
})
