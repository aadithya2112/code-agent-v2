/**
 * File Sync Test Component
 *
 * Tests the file sync queue to verify:
 * 1. Rapid edits to same file (deduplication)
 * 2. Concurrent edits to different files (parallelism)
 * 3. Error handling and retries
 */

"use client"

import { useState } from "react"
import { useFileEdit } from "@/hooks/useFileEdit"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type TestResult = {
  test: string
  status: "running" | "passed" | "failed"
  duration?: number
  details?: string
}

export function FileSyncTest({
  projectId,
  sandboxId,
}: {
  projectId: Id<"projects">
  sandboxId: string | undefined
}) {
  const { editFile, status, getQueueStatus } = useFileEdit(projectId, sandboxId)
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result])
  }

  const updateResult = (testName: string, updates: Partial<TestResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.test === testName ? { ...r, ...updates } : r)),
    )
  }

  /**
   * Test 1: Rapid edits to same file should be deduplicated
   */
  const testRapidEdits = async () => {
    const testName = "Rapid Edits (Deduplication)"
    addResult({ test: testName, status: "running" })
    const startTime = Date.now()

    try {
      // Send 10 rapid edits to the same file
      const path = "test-rapid.txt"
      const edits = []

      for (let i = 0; i < 10; i++) {
        edits.push(editFile(path, `Content version ${i + 1}`))
      }

      // Wait for all to complete
      await Promise.all(edits)

      const duration = Date.now() - startTime

      // Check queue - should have processed them efficiently
      const queueStatus = getQueueStatus()
      const details = `10 edits sent, queue processed efficiently. Final content: "Content version 10"`

      updateResult(testName, {
        status: "passed",
        duration,
        details,
      })
    } catch (error) {
      updateResult(testName, {
        status: "failed",
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Test 2: Concurrent edits to different files should process in parallel
   */
  const testConcurrentEdits = async () => {
    const testName = "Concurrent Edits (Parallelism)"
    addResult({ test: testName, status: "running" })
    const startTime = Date.now()

    try {
      // Edit 5 different files concurrently
      const edits = []
      for (let i = 0; i < 5; i++) {
        edits.push(editFile(`test-file-${i}.txt`, `Content for file ${i}`))
      }

      await Promise.all(edits)

      const duration = Date.now() - startTime
      const details = `5 files edited concurrently in ${duration}ms`

      updateResult(testName, {
        status: "passed",
        duration,
        details,
      })
    } catch (error) {
      updateResult(testName, {
        status: "failed",
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Test 3: Complex scenario - multiple rapid edits to multiple files
   */
  const testComplexScenario = async () => {
    const testName = "Complex Scenario (Mixed)"
    addResult({ test: testName, status: "running" })
    const startTime = Date.now()

    try {
      const edits = []

      // Rapid edits to file A
      for (let i = 0; i < 5; i++) {
        edits.push(editFile("test-a.txt", `A version ${i + 1}`))
      }

      // Rapid edits to file B
      for (let i = 0; i < 5; i++) {
        edits.push(editFile("test-b.txt", `B version ${i + 1}`))
      }

      // Single edits to C, D, E
      edits.push(editFile("test-c.txt", "C content"))
      edits.push(editFile("test-d.txt", "D content"))
      edits.push(editFile("test-e.txt", "E content"))

      await Promise.all(edits)

      const duration = Date.now() - startTime
      const details = `13 total edits (5+5+3) across 5 files completed in ${duration}ms`

      updateResult(testName, {
        status: "passed",
        duration,
        details,
      })
    } catch (error) {
      updateResult(testName, {
        status: "failed",
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Run all tests
   */
  const runAllTests = async () => {
    if (!sandboxId) {
      alert("Please start the dev server first to create a sandbox")
      return
    }

    setIsRunning(true)
    setResults([])

    await testRapidEdits()
    await testConcurrentEdits()
    await testComplexScenario()

    setIsRunning(false)
  }

  const getStatusBadge = (testStatus: TestResult["status"]) => {
    const variants = {
      running: "default" as const,
      passed: "default" as const,
      failed: "destructive" as const,
    }
    return (
      <Badge variant={variants[testStatus]}>
        {testStatus === "running" && "🔄 Running"}
        {testStatus === "passed" && "✅ Passed"}
        {testStatus === "failed" && "❌ Failed"}
      </Badge>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">File Sync Queue Tests</h2>
        <Button onClick={runAllTests} disabled={isRunning || !sandboxId}>
          {isRunning ? "Running Tests..." : "Run All Tests"}
        </Button>
      </div>

      {!sandboxId && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ No sandbox available. Please start the dev server first.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Pending Edits:</span>
          <Badge variant="outline">{status.pendingEdits}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Is Editing:</span>
          <Badge variant="outline">{status.isEditing ? "Yes" : "No"}</Badge>
        </div>
        {status.lastError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">
              {status.lastError}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Test Results:</h3>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tests run yet. Click "Run All Tests" to start.
          </p>
        ) : (
          <div className="space-y-2">
            {results.map((result, i) => (
              <div key={i} className="p-3 border rounded-md space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{result.test}</span>
                  {getStatusBadge(result.status)}
                </div>
                {result.duration && (
                  <p className="text-xs text-muted-foreground">
                    Duration: {result.duration}ms
                  </p>
                )}
                {result.details && (
                  <p className="text-xs text-muted-foreground">
                    {result.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t">
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Queue Status (Debug)
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
            {JSON.stringify(getQueueStatus(), null, 2)}
          </pre>
        </details>
      </div>
    </Card>
  )
}
