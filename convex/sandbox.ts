"use node"

import { action } from "./_generated/server"
import { v } from "convex/values"
import { api } from "./_generated/api"
import { Sandbox } from "@e2b/code-interpreter"

export const createSandbox = action({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }): Promise<string> => {
    // Get all files for this project
    const files = await ctx.runQuery(api.files.getFiles, { projectId })

    console.log(
      `Creating sandbox for project ${projectId} with ${files.length} files`,
    )

    if (files.length === 0) {
      throw new Error(
        "Cannot create sandbox: no files found. Template initialization may have failed.",
      )
    }

    // Create E2B sandbox
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
    })

    console.log(`Sandbox created: ${sandbox.sandboxId}`)

    // Write all files to sandbox
    for (const file of files) {
      try {
        console.log(`Writing file: ${file.path} (${file.content.length} bytes)`)
        await sandbox.files.write(file.path, file.content)

        // Debug: Show vite.config.ts content
        if (file.path === "vite.config.ts") {
          console.log("vite.config.ts content:", file.content)
        }
      } catch (error) {
        console.warn(`Failed to write ${file.path}:`, error)
      }
    }

    // Verify vite.config.ts was written correctly
    try {
      const viteConfig = await sandbox.files.read("vite.config.ts")
      console.log("Verified vite.config.ts in sandbox:", viteConfig)
    } catch (error) {
      console.error("Failed to verify vite.config.ts:", error)
    }

    // Run npm install
    console.log("Running npm install...")
    const installResult = await sandbox.commands.run("npm install")

    console.log("npm install output:", installResult.stdout)
    if (installResult.stderr) {
      console.warn("npm install errors:", installResult.stderr)
    }

    // Store sandbox ID in project
    await ctx.runMutation(api.projects.updateSandboxId, {
      projectId,
      sandboxId: sandbox.sandboxId,
    })

    return sandbox.sandboxId
  },
})

export const destroySandbox = action({
  args: {
    sandboxId: v.string(),
  },
  handler: async (ctx, { sandboxId }): Promise<void> => {
    console.log(`Destroying sandbox: ${sandboxId}`)
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    })
    await sandbox.kill()
  },
})

export const startDevServer = action({
  args: {
    projectId: v.id("projects"),
    sandboxId: v.string(),
  },
  handler: async (ctx, { projectId, sandboxId }): Promise<string> => {
    console.log(`Starting dev server in sandbox: ${sandboxId}`)

    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    })

    // Start the dev server in the background with DANGEROUSLY_DISABLE_HOST_CHECK
    const devProcess = await sandbox.commands.run(
      "DANGEROUSLY_DISABLE_HOST_CHECK=true npm run dev",
      {
        background: true,
      },
    )

    console.log("Dev server process started, waiting for URL...")

    // Wait a bit for the server to start and output the URL
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // The URL should be in the format: http://localhost:5173 for Vite
    // We need to get the sandbox's public URL
    const hostname = await sandbox.getHost(5173)
    const previewUrl = `https://${hostname}`

    console.log(`Dev server running at: ${previewUrl}`)

    // Store the preview URL in the project
    await ctx.runMutation(api.projects.updateDevServerUrl, {
      projectId,
      devServerUrl: previewUrl,
    })

    return previewUrl
  },
})

export const stopDevServer = action({
  args: {
    projectId: v.id("projects"),
    sandboxId: v.string(),
  },
  handler: async (ctx, { projectId, sandboxId }): Promise<void> => {
    console.log(`Stopping dev server in sandbox: ${sandboxId}`)

    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    })

    // Kill all node processes (which includes the dev server)
    // Use || true to prevent error if no processes are found
    await sandbox.commands.run(
      "pkill -f 'npm run dev' || pkill -f 'node' || true",
    )

    // Clear the preview URL
    await ctx.runMutation(api.projects.updateDevServerUrl, {
      projectId,
      devServerUrl: undefined,
    })

    console.log("Dev server stopped")
  },
})
