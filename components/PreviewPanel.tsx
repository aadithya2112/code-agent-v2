"use client"

import React, { useState } from "react"
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewConsole,
} from "@/components/ai-elements/web-preview"
import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from "lucide-react"

interface PreviewPanelProps {
  previewUrl?: string
}

export function PreviewPanel({ previewUrl }: PreviewPanelProps) {
  const [url, setUrl] = useState(previewUrl || "")
  const [history, setHistory] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  // Update URL when previewUrl prop changes
  React.useEffect(() => {
    if (previewUrl && previewUrl !== url) {
      setUrl(previewUrl)
      if (history.length === 0 || history[history.length - 1] !== previewUrl) {
        const newHistory = [...history, previewUrl]
        setHistory(newHistory)
        setCurrentIndex(newHistory.length - 1)
      }
    }
  }, [previewUrl])

  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < history.length - 1

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    const newHistory = history.slice(0, currentIndex + 1)
    newHistory.push(newUrl)
    setHistory(newHistory)
    setCurrentIndex(newHistory.length - 1)
  }

  const handleBack = () => {
    if (canGoBack) {
      setCurrentIndex(currentIndex - 1)
      setUrl(history[currentIndex - 1])
    }
  }

  const handleForward = () => {
    if (canGoForward) {
      setCurrentIndex(currentIndex + 1)
      setUrl(history[currentIndex + 1])
    }
  }

  const handleRefresh = () => {
    // Force reload by setting key or triggering re-render
    setUrl(url + "")
  }

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/20">
        <div className="text-center space-y-2">
          <p className="text-sm">No preview available</p>
          <p className="text-xs text-muted-foreground">
            Click "Start" to launch the dev server
          </p>
        </div>
      </div>
    )
  }

  return (
    <WebPreview
      defaultUrl={previewUrl}
      onUrlChange={handleUrlChange}
      className="h-full border-0 rounded-none"
    >
      <WebPreviewNavigation>
        <WebPreviewNavigationButton
          disabled={!canGoBack}
          onClick={handleBack}
          tooltip="Go back"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </WebPreviewNavigationButton>
        <WebPreviewNavigationButton
          disabled={!canGoForward}
          onClick={handleForward}
          tooltip="Go forward"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </WebPreviewNavigationButton>
        <WebPreviewNavigationButton onClick={handleRefresh} tooltip="Refresh">
          <RotateCwIcon className="h-4 w-4" />
        </WebPreviewNavigationButton>
        <WebPreviewUrl />
      </WebPreviewNavigation>
      <WebPreviewBody />
      <WebPreviewConsole />
    </WebPreview>
  )
}
