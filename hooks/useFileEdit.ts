/**
 * useFileEdit Hook
 *
 * Provides a coordinated way to edit files with automatic sync to E2B sandbox.
 * Handles the complete flow: Convex update -> Queue management -> E2B sync
 *
 * Features:
 * - Automatic queuing to prevent race conditions
 * - Version tracking for conflict detection
 * - Error handling with retries
 * - Loading states for UI feedback
 */

import { useState, useCallback } from "react"
import { useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { fileSyncQueue } from "@/lib/fileSyncQueue"

export type FileEditStatus = {
  isEditing: boolean
  pendingEdits: number
  lastError: string | null
}

export function useFileEdit(
  projectId: Id<"projects">,
  sandboxId: string | undefined,
) {
  const [status, setStatus] = useState<FileEditStatus>({
    isEditing: false,
    pendingEdits: 0,
    lastError: null,
  })

  const updateFileMutation = useMutation(api.files.updateFile)
  const syncFileAction = useAction(api.sandbox.syncFileToSandbox)

  /**
   * Edit a file with automatic sync to sandbox
   */
  const editFile = useCallback(
    async (path: string, content: string): Promise<boolean> => {
      if (!sandboxId) {
        setStatus((prev) => ({
          ...prev,
          lastError: "No sandbox available. Please start the dev server first.",
        }))
        return false
      }

      setStatus((prev) => ({
        ...prev,
        isEditing: true,
        pendingEdits: prev.pendingEdits + 1,
        lastError: null,
      }))

      try {
        // Queue the edit - this handles deduplication and retries
        const result = await fileSyncQueue.queueEdit(
          path,
          content,
          // Update function (Convex mutation)
          async (p, c) => {
            const result = await updateFileMutation({
              projectId,
              path: p,
              content: c,
            })
            return { version: result.version }
          },
          // Sync function (E2B action)
          async (p, c, version) => {
            await syncFileAction({
              sandboxId: sandboxId!,
              path: p,
              content: c,
              version,
            })
          },
        )

        setStatus((prev) => ({
          ...prev,
          isEditing: prev.pendingEdits <= 1 ? false : true,
          pendingEdits: Math.max(0, prev.pendingEdits - 1),
        }))

        return result.success
      } catch (error) {
        setStatus((prev) => ({
          ...prev,
          isEditing: prev.pendingEdits <= 1 ? false : true,
          pendingEdits: Math.max(0, prev.pendingEdits - 1),
          lastError:
            error instanceof Error ? error.message : "Failed to edit file",
        }))
        console.error("File edit failed:", error)
        return false
      }
    },
    [projectId, sandboxId, updateFileMutation, syncFileAction],
  )

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setStatus((prev) => ({ ...prev, lastError: null }))
  }, [])

  /**
   * Get current queue status for debugging
   */
  const getQueueStatus = useCallback(() => {
    return fileSyncQueue.getStatus()
  }, [])

  return {
    editFile,
    status,
    clearError,
    getQueueStatus,
  }
}
