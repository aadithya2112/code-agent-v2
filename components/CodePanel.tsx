"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileIcon, FolderIcon, ChevronRightIcon, SaveIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { MonacoEditor } from "@/components/MonacoEditor"
import { useFileEdit } from "@/hooks/useFileEdit"
import { Badge } from "@/components/ui/badge"

interface CodePanelProps {
  projectId: Id<"projects">
}

export function CodePanel({ projectId }: CodePanelProps) {
  const files = useQuery(api.files.getProjectFiles, { projectId })
  const project = useQuery(api.projects.getProject, { projectId })
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { editFile, status } = useFileEdit(projectId, project?.sandboxId)

  if (files === undefined) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-sm">Loading files...</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20">
        <div className="text-center space-y-2">
          <p className="text-sm">No code generated yet</p>
          <p className="text-xs text-muted-foreground">
            Files will appear once the project is created
          </p>
        </div>
      </div>
    )
  }

  const selectedFileData = files.find((f) => f.path === selectedFile)

  // Build file tree structure
  const fileTree: Record<string, any> = {}
  files.forEach((file) => {
    const parts = file.path.split("/")
    let current = fileTree
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = file
      } else {
        current[part] = current[part] || {}
        current = current[part]
      }
    })
  })

  const handleFileChange = async (content: string) => {
    if (!selectedFile) return
    await editFile(selectedFile, content)
  }

  const renderTree = (
    tree: Record<string, any>,
    depth = 0,
  ): React.ReactNode => {
    return Object.entries(tree).map(([name, value]) => {
      const isFile = value._id !== undefined
      const path = isFile ? value.path : null

      if (isFile) {
        return (
          <button
            key={value._id}
            onClick={() => setSelectedFile(value.path)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left",
              selectedFile === value.path && "bg-accent",
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{name}</span>
          </button>
        )
      }

      return (
        <div key={name}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground"
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            <FolderIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{name}</span>
          </div>
          {renderTree(value, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Status Bar */}
      {selectedFileData && (
        <div className="border-b border-border px-4 py-2 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground">
              {selectedFileData.path}
            </span>
            {status.isEditing && (
              <Badge variant="outline" className="text-xs">
                <SaveIcon className="h-3 w-3 mr-1" />
                Saving...
              </Badge>
            )}
          </div>
          {status.pendingEdits > 0 && (
            <Badge variant="secondary" className="text-xs">
              {status.pendingEdits} pending
            </Badge>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* File Tree */}
        <div className="w-64 border-r border-border overflow-auto">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold">Files</h3>
          </div>
          <div className="py-2">{renderTree(fileTree)}</div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 overflow-hidden">
          {selectedFileData ? (
            <MonacoEditor
              path={selectedFileData.path}
              content={selectedFileData.content}
              onChangeAction={handleFileChange}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <p className="text-sm">Select a file to edit</p>
                <p className="text-xs text-muted-foreground">
                  Click on a file in the tree
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {status.lastError && (
        <div className="border-t border-border px-4 py-2 bg-destructive/10">
          <p className="text-sm text-destructive">{status.lastError}</p>
        </div>
      )}
    </div>
  )
}
