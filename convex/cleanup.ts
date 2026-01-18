"use node"

import { action } from "./_generated/server"
import { Sandbox } from "@e2b/code-interpreter"

// List all sandboxes (for debugging)
export const listAllSandboxes = action({
  args: {},
  handler: async (): Promise<any[]> => {
    try {
      const response = await fetch("https://api.e2b.dev/sandboxes", {
        headers: {
          "X-API-Key": process.env.E2B_API_KEY || "",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to list sandboxes: ${response.statusText}`)
      }

      const sandboxes = await response.json()
      console.log(`Found ${sandboxes.length} sandboxes:`, sandboxes)
      return sandboxes
    } catch (error) {
      console.error("Error listing sandboxes:", error)
      throw error
    }
  },
})

// Kill all sandboxes (DANGER: use with caution!)
export const killAllSandboxes = action({
  args: {},
  handler: async (): Promise<void> => {
    try {
      const response = await fetch("https://api.e2b.dev/sandboxes", {
        headers: {
          "X-API-Key": process.env.E2B_API_KEY || "",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to list sandboxes: ${response.statusText}`)
      }

      const sandboxes = (await response.json()) as Array<{ sandboxID: string }>

      console.log(`Killing ${sandboxes.length} sandboxes...`)

      for (const sandbox of sandboxes) {
        try {
          const sbx = await Sandbox.connect(sandbox.sandboxID, {
            apiKey: process.env.E2B_API_KEY,
          })
          await sbx.kill()
          console.log(`Killed sandbox: ${sandbox.sandboxID}`)
        } catch (error) {
          console.warn(`Failed to kill ${sandbox.sandboxID}:`, error)
        }
      }

      console.log("All sandboxes killed")
    } catch (error) {
      console.error("Error killing sandboxes:", error)
      throw error
    }
  },
})
