/**
 * Monaco Editor Component
 *
 * A code editor with syntax highlighting and debounced auto-save.
 * Features:
 * - Syntax highlighting for multiple languages
 * - Debounced onChange (300ms) to prevent excessive updates
 * - Dark/light theme support
 * - TypeScript, JavaScript, CSS, HTML, JSON support
 */

"use client"

import { useEffect, useRef, useState } from "react"
import Editor from "@monaco-editor/react"
import { useTheme } from "next-themes"

type MonacoEditorProps = {
  path: string
  content: string
  onChangeAction: (content: string) => void
  readOnly?: boolean
}

export function MonacoEditor({
  path,
  content,
  onChangeAction,
  readOnly = false,
}: MonacoEditorProps) {
  const { theme } = useTheme()
  const [localContent, setLocalContent] = useState(content)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Update local content when prop changes (e.g., switching files)
  useEffect(() => {
    setLocalContent(content)
  }, [content, path])

  // Get language from file extension
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript"
      case "js":
      case "jsx":
        return "javascript"
      case "json":
        return "json"
      case "css":
        return "css"
      case "html":
        return "html"
      case "md":
        return "markdown"
      case "yml":
      case "yaml":
        return "yaml"
      default:
        return "plaintext"
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return

    setLocalContent(value)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debounced save
    debounceTimerRef.current = setTimeout(() => {
      onChangeAction(value)
    }, 300) // 300ms debounce
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <Editor
      height="100%"
      language={getLanguage(path)}
      value={localContent}
      onChange={handleEditorChange}
      theme={theme === "dark" ? "vs-dark" : "light"}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        formatOnPaste: true,
        formatOnType: true,
      }}
      loading={
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-muted-foreground">Loading editor...</div>
        </div>
      }
    />
  )
}
