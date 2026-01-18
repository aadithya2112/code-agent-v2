"use client"

import { use, useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { PreviewPanel } from "@/components/PreviewPanel"
import { CodePanel } from "@/components/CodePanel"
import Link from "next/link"
import { CornerDownLeftIcon } from "lucide-react"

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const projectId = id as Id<"projects">
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined)
  const [isServerRunning, setIsServerRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const isCreatingSandboxRef = useRef(false)

  const project = useQuery(api.projects.getProject, { projectId })
  const messages = useQuery(api.messages.getMessages, { projectId })
  const files = useQuery(api.files.getProjectFiles, { projectId })
  const createMessage = useMutation(api.messages.createMessage)
  const updateProjectFromMessage = useMutation(
    api.projects.updateProjectFromMessage,
  )
  const updateProjectName = useMutation(api.projects.updateProjectName)
  const initializeProjectWithTemplate = useAction(
    api.projects.initializeProjectWithTemplate,
  )
  const createSandbox = useAction(api.sandbox.createSandbox)
  const startDevServer = useAction(api.sandbox.startDevServer)
  const stopDevServer = useAction(api.sandbox.stopDevServer)

  const isFirstMessage = messages?.length === 0

  // Cleanup: Stop dev server when leaving the page
  useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      if (project?.sandboxId && project?.devServerUrl) {
        stopDevServer({ projectId, sandboxId: project.sandboxId }).catch(
          (err) => console.error("Failed to stop dev server on unmount:", err),
        )
      }
    }
  }, [project?.sandboxId, project?.devServerUrl, projectId, stopDevServer])

  // Sync preview URL from project
  useEffect(() => {
    if (project?.devServerUrl) {
      setPreviewUrl(project.devServerUrl)
      setIsServerRunning(true)
    } else {
      setPreviewUrl(undefined)
      setIsServerRunning(false)
    }
  }, [project?.devServerUrl])

  // Auto-create sandbox when files are ready
  useEffect(() => {
    const initializeSandbox = async () => {
      // Guard conditions: only create if we don't have a sandbox, files exist, and we're not already creating one
      if (
        !project?.sandboxId &&
        project &&
        files &&
        files.length > 0 &&
        !isCreatingSandboxRef.current
      ) {
        isCreatingSandboxRef.current = true
        try {
          await createSandbox({ projectId })
        } catch (error) {
          console.error("Failed to create sandbox:", error)
          isCreatingSandboxRef.current = false
        }
      }
    }

    initializeSandbox()
  }, [project?.sandboxId, files?.length, projectId, createSandbox])

  const handleStartEditingTitle = () => {
    if (project) {
      setEditedTitle(project.name)
      setIsEditingTitle(true)
    }
  }

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === project?.name) {
      setIsEditingTitle(false)
      return
    }

    try {
      await updateProjectName({
        projectId,
        name: editedTitle.trim(),
      })
      setIsEditingTitle(false)
    } catch (error) {
      console.error("Failed to update project name:", error)
    }
  }

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false)
    setEditedTitle("")
  }

  const handleToggleServer = async () => {
    if (!project?.sandboxId) {
      console.error("No sandbox ID available")
      return
    }

    try {
      if (isServerRunning) {
        // Stop the server
        await stopDevServer({ projectId, sandboxId: project.sandboxId })
      } else {
        // Start the server
        await startDevServer({
          projectId,
          sandboxId: project.sandboxId,
        })
      }
    } catch (error) {
      console.error("Failed to toggle server:", error)
    }
  }

  const handleSubmit = async (input: any) => {
    if (isSubmitting) return

    const text = input.text?.trim()
    if (!text) return

    setIsSubmitting(true)
    try {
      // If this is the first message, initialize project with template
      if (isFirstMessage) {
        await updateProjectFromMessage({
          projectId,
          userMessage: text,
        })

        // Initialize project with template files
        await initializeProjectWithTemplate({ projectId })
      }

      // Create the user message
      await createMessage({
        projectId,
        role: "user",
        content: text,
      })

      // TODO: Here we'll add AI agent integration to generate response
      // For now, just create a placeholder assistant message
      await createMessage({
        projectId,
        role: "assistant",
        content: "I'll help you build that! (AI agent integration coming soon)",
      })
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveTitle()
                } else if (e.key === "Escape") {
                  handleCancelEditTitle()
                }
              }}
              className="text-lg font-semibold bg-transparent border-b-2 border-primary focus:outline-none px-1"
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors px-1"
              onClick={handleStartEditingTitle}
              title="Click to edit project name"
            >
              {project.name}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              My Projects
            </Button>
          </Link>
          <UserButton />
        </div>
      </header>

      {/* Main Content - Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat (40%) */}
        <div className="w-2/5 flex flex-col border-r border-border">
          <div className="flex-1 overflow-hidden">
            <Conversation className="h-full">
              <ConversationContent className="px-4">
                {messages === undefined ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-muted-foreground">
                      Loading messages...
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Start Building</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Describe what you want to build, and I'll help you
                        create it.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <Message key={message._id} from={message.role}>
                      <MessageContent>
                        <MessageResponse>{message.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))
                )}
              </ConversationContent>
            </Conversation>
          </div>

          {/* Prompt Input */}
          <div className="border-t border-border p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const text = formData.get("message") as string
                if (text?.trim()) {
                  handleSubmit({ text })
                  e.currentTarget.reset()
                }
              }}
              className="relative"
            >
              <textarea
                name="message"
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe what you want to build..."
                disabled={isSubmitting}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="absolute bottom-3 right-3"
              >
                {isSubmitting ? (
                  "Sending..."
                ) : (
                  <CornerDownLeftIcon className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Right Panel - Preview/Code (60%) */}
        <div className="w-3/5 flex flex-col">
          {/* Tab Switcher */}
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="flex gap-1">
              <Button
                variant={activeTab === "preview" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </Button>
              <Button
                variant={activeTab === "code" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("code")}
              >
                Code
              </Button>
            </div>

            {/* Stop/Start Button */}
            <div className="flex items-center gap-2">
              {isServerRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Running</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleServer}
                disabled={!project?.sandboxId}
              >
                {isServerRunning ? "Stop" : "Start"}
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "preview" ? (
              <PreviewPanel previewUrl={previewUrl} />
            ) : (
              <CodePanel projectId={projectId} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
