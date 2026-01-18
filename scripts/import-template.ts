#!/usr/bin/env tsx

/**
 * Import template from GitHub repository
 * Fetches all files from aadithya2112/code-agent-react-starter and generates convex/templates.ts
 */

const REPO_OWNER = "aadithya2112"
const REPO_NAME = "code-agent-react-starter"
const BRANCH = "main"

interface GitHubTreeItem {
  path: string
  mode: string
  type: string
  sha: string
  size?: number
  url: string
}

interface GitHubTree {
  sha: string
  url: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

interface FileItem {
  path: string
  content: string
}

// Files and directories to ignore
const IGNORE_PATTERNS = [
  /^\.git/,
  /^node_modules/,
  /^\.next/,
  /^dist/,
  /^build/,
  /\.lock$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^bun\.lockb$/,
  /\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i,
]

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(path))
}

async function fetchGitHubTree(): Promise<GitHubTreeItem[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`

  console.log(`Fetching file tree from ${url}...`)

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "code-agent-template-importer",
    },
  })

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    )
  }

  const data = (await response.json()) as GitHubTree

  console.log(`Found ${data.tree.length} items in repository`)

  // Filter to only files (not directories)
  const files = data.tree.filter(
    (item) => item.type === "blob" && !shouldIgnore(item.path),
  )

  console.log(`After filtering: ${files.length} files to download`)

  return files
}

async function downloadFile(item: GitHubTreeItem): Promise<FileItem | null> {
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${item.path}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to download ${item.path}: ${response.status}`)
      return null
    }

    const content = await response.text()

    // Skip if content looks binary (has null bytes)
    if (content.includes("\0")) {
      console.log(`Skipping binary file: ${item.path}`)
      return null
    }

    console.log(`Downloaded: ${item.path} (${content.length} bytes)`)

    return {
      path: item.path,
      content,
    }
  } catch (error) {
    console.warn(`Error downloading ${item.path}:`, error)
    return null
  }
}

async function downloadAllFiles(items: GitHubTreeItem[]): Promise<FileItem[]> {
  console.log(`\nDownloading ${items.length} files...`)

  const files: FileItem[] = []

  // Download files in batches to avoid rate limiting
  const batchSize = 10
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(downloadFile))

    for (const file of results) {
      if (file) {
        files.push(file)
      }
    }

    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  console.log(`\nSuccessfully downloaded ${files.length} files`)

  return files
}

function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")
}

function generateTemplateFile(files: FileItem[]): string {
  const fileItems = files
    .map(
      (file) => `  {
    path: "${file.path}",
    content: \`${escapeString(file.content)}\`,
  }`,
    )
    .join(",\n")

  return `"use node";

import { action } from "./_generated/server";

interface FileItem {
  path: string;
  content: string;
}

// Template files imported from https://github.com/${REPO_OWNER}/${REPO_NAME}
// Last updated: ${new Date().toISOString()}
// Total files: ${files.length}
const TEMPLATE_FILES: FileItem[] = [
${fileItems}
];

export const cloneTemplate = action({
  args: {},
  handler: async (): Promise<FileItem[]> => {
    console.log(\`Returning \${TEMPLATE_FILES.length} static template files\`);
    return TEMPLATE_FILES;
  },
});
`
}

async function main() {
  try {
    console.log("🚀 Starting template import from GitHub...\n")

    // Fetch file tree
    const treeItems = await fetchGitHubTree()

    // Download all files
    const files = await downloadAllFiles(treeItems)

    if (files.length === 0) {
      throw new Error("No files were downloaded!")
    }

    // Generate new templates.ts content
    console.log("\n📝 Generating convex/templates.ts...")
    const templateContent = generateTemplateFile(files)

    // Write to file
    const fs = await import("fs")
    const path = await import("path")

    const outputPath = path.join(process.cwd(), "convex", "templates.ts")

    fs.writeFileSync(outputPath, templateContent, "utf-8")

    console.log(
      `\n✅ Successfully wrote ${files.length} files to ${outputPath}`,
    )
    console.log(
      "\n📊 File size:",
      (templateContent.length / 1024).toFixed(2),
      "KB",
    )
    console.log("\nYou can now commit this file to version control.")
  } catch (error) {
    console.error("\n❌ Error:", error)
    process.exit(1)
  }
}

main()
