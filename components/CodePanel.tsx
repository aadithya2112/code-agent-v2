"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { CodeBlock } from "@/components/ai-elements/code-block"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileIcon, FolderIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface CodePanelProps {
  projectId: Id<"projects">
}

export function CodePanel({ projectId }: CodePanelProps) {
  const files = useQuery(api.files.getProjectFiles, { projectId })
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

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
    <div className="h-full flex">
      {/* File Tree */}
      <div className="w-64 border-r border-border overflow-auto">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold">Files</h3>
        </div>
        <div className="py-2">{renderTree(fileTree)}</div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 overflow-auto">
        {selectedFileData ? (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-sm font-mono text-muted-foreground">
                {selectedFileData.path}
              </h3>
            </div>
            <CodeBlock
              language={getLanguageFromPath(selectedFileData.path) as any}
              code={selectedFileData.content}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-sm">Select a file to view</p>
              <p className="text-xs text-muted-foreground">
                Click on a file in the tree
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    html: "html",
    md: "markdown",
    py: "python",
    go: "go",
    rs: "rust",
    yml: "yaml",
    yaml: "yaml",
  }
  return languageMap[ext || ""] || "plaintext"
}
