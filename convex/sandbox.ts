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
        await sandbox.files.write(file.path, file.content)
      } catch (error) {
        console.warn(`Failed to write ${file.path}:`, error)
      }
    }

    // Run npm install
    console.log("Running npm install...")
    const installResult = await sandbox.commands.run("npm install")

    if (installResult.exitCode !== 0) {
      console.warn("npm install had warnings:", installResult.stderr)
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

    let sandbox: Sandbox
    
    try {
      // Try to connect to existing sandbox
      sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      })
    } catch (error) {
      // Sandbox doesn't exist anymore - create a new one
      console.log(`Sandbox ${sandboxId} not found, creating new sandbox...`)
      
      const newSandboxId = await ctx.runAction(api.sandbox.createSandbox, {
        projectId,
      })
      
      // Connect to the newly created sandbox
      sandbox = await Sandbox.connect(newSandboxId, {
        apiKey: process.env.E2B_API_KEY,
      })
      
      sandboxId = newSandboxId
      console.log(`New sandbox created: ${sandboxId}`)
    }

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

    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      })

      // Kill all node processes (which includes the dev server)
      // Run in background to avoid waiting for process termination
      try {
        await sandbox.commands.run(
          "pkill -f 'vite' || pkill -f 'node' || true",
          { background: false },
        )
      } catch (error) {
        // Ignore errors from pkill - process might already be dead
        console.log("Process kill completed (errors ignored)")
      }

      // Clear the preview URL
      await ctx.runMutation(api.projects.updateDevServerUrl, {
        projectId,
        devServerUrl: undefined,
      })

      console.log("Dev server stopped")
    } catch (error) {
      console.error("Error stopping dev server:", error)
      // Still try to clear the URL even if we couldn't connect
      await ctx.runMutation(api.projects.updateDevServerUrl, {
        projectId,
        devServerUrl: undefined,
      })
    }
  },
})
