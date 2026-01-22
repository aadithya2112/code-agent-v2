/**
 * File Sync Queue Manager
 *
 * Handles sequential file synchronization to prevent race conditions.
 * Features:
 * - Per-file queues: Different files can sync in parallel
 * - Deduplication: Multiple edits to same file are batched (latest wins)
 * - Retry logic: Failed syncs are retried with exponential backoff
 * - Error handling: Failures don't block other files
 */

type SyncOperation = {
  path: string
  content: string
  timestamp: number
  retries: number
}

type QueueItem = {
  operation: SyncOperation
  resolve: (value: { success: boolean; version?: number }) => void
  reject: (error: Error) => void
}

class FileSyncQueue {
  // Map of file path -> queue of operations for that file
  private queues: Map<string, QueueItem[]> = new Map()

  // Map of file path -> whether that file's queue is currently processing
  private processing: Map<string, boolean> = new Map()

  // Configuration
  private maxRetries = 3
  private baseRetryDelay = 1000 // 1 second

  /**
   * Queue a file edit for synchronization
   * If the same file is already queued, this will replace the pending operation
   * (deduplication - latest content wins)
   */
  async queueEdit(
    path: string,
    content: string,
    updateFn: (path: string, content: string) => Promise<{ version: number }>,
    syncFn: (path: string, content: string, version: number) => Promise<void>,
  ): Promise<{ success: boolean; version?: number }> {
    return new Promise((resolve, reject) => {
      const operation: SyncOperation = {
        path,
        content,
        timestamp: Date.now(),
        retries: 0,
      }

      // Get or create queue for this file
      let queue = this.queues.get(path)
      if (!queue) {
        queue = []
        this.queues.set(path, queue)
      }

      // Deduplication: If there's already a pending operation for this file,
      // replace it with the new one (latest wins)
      const isProcessing = this.processing.get(path) || false

      if (queue.length > 0) {
        if (isProcessing) {
          // Something is currently processing (index 0)
          // Remove all pending items (index 1+) and reject their promises
          const itemsToReject = queue.splice(1)
          itemsToReject.forEach((item) => {
            item.resolve({ success: true, version: -1 }) // Silently succeed - newer edit will handle it
          })
        } else {
          // Nothing processing yet, remove all items and reject
          const itemsToReject = queue.splice(0)
          itemsToReject.forEach((item) => {
            item.resolve({ success: true, version: -1 }) // Silently succeed - newer edit will handle it
          })
        }
      }

      // Add new operation to queue
      queue.push({
        operation,
        resolve,
        reject,
      })

      // Start processing if not already processing
      if (!this.processing.get(path)) {
        this.processQueue(path, updateFn, syncFn)
      }
    })
  }

  /**
   * Process the queue for a specific file path
   */
  private async processQueue(
    path: string,
    updateFn: (path: string, content: string) => Promise<{ version: number }>,
    syncFn: (path: string, content: string, version: number) => Promise<void>,
  ): Promise<void> {
    this.processing.set(path, true)

    const queue = this.queues.get(path)
    if (!queue) {
      this.processing.set(path, false)
      return
    }

    while (queue.length > 0) {
      const item = queue[0] // Peek at first item

      try {
        // Step 1: Update Convex (source of truth)
        const { version } = await updateFn(
          item.operation.path,
          item.operation.content,
        )

        // Step 2: Sync to E2B sandbox
        await syncFn(item.operation.path, item.operation.content, version)

        // Success! Remove from queue and resolve
        queue.shift()
        item.resolve({ success: true, version })
      } catch (error) {
        // Handle failure
        item.operation.retries++

        if (item.operation.retries >= this.maxRetries) {
          // Max retries exceeded, give up
          queue.shift()
          item.reject(
            new Error(
              `Failed to sync ${path} after ${this.maxRetries} attempts: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            ),
          )
        } else {
          // Retry with exponential backoff
          const delay =
            this.baseRetryDelay * Math.pow(2, item.operation.retries - 1)
          console.log(
            `Retrying ${path} in ${delay}ms (attempt ${item.operation.retries}/${this.maxRetries})`,
          )

          await new Promise((resolve) => setTimeout(resolve, delay))
          // Loop will retry
        }
      }
    }

    // Queue is empty, mark as not processing
    this.processing.set(path, false)

    // Clean up empty queue
    if (queue.length === 0) {
      this.queues.delete(path)
      this.processing.delete(path)
    }
  }

  /**
   * Get the current queue status for debugging
   */
  getStatus(): {
    queuedFiles: string[]
    processingFiles: string[]
    totalPendingOperations: number
  } {
    const queuedFiles = Array.from(this.queues.keys())
    const processingFiles = Array.from(this.processing.entries())
      .filter(([_, isProcessing]) => isProcessing)
      .map(([path, _]) => path)

    const totalPendingOperations = Array.from(this.queues.values()).reduce(
      (sum, queue) => sum + queue.length,
      0,
    )

    return {
      queuedFiles,
      processingFiles,
      totalPendingOperations,
    }
  }

  /**
   * Clear all queues (useful for cleanup)
   */
  clear(): void {
    this.queues.clear()
    this.processing.clear()
  }
}

// Export singleton instance
export const fileSyncQueue = new FileSyncQueue()
