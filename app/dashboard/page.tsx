"use client"

import { UserButton } from "@clerk/nextjs"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { Id } from "@/convex/_generated/dataModel"

export default function DashboardPage() {
  const router = useRouter()
  const projects = useQuery(api.projects.getProjects)
  const createEmptyProject = useMutation(api.projects.createEmptyProject)
  const deleteProject = useMutation(api.projects.deleteProject)

  const handleCreateProject = async () => {
    try {
      const projectId = await createEmptyProject()
      // Auto-redirect to the new project
      router.push(`/project/${projectId}`)
    } catch (error) {
      console.error("Failed to create project:", error)
      alert("Failed to create project. Please try again.")
    }
  }

  const handleDeleteProject = async (projectId: Id<"projects">) => {
    if (!confirm("Are you sure you want to delete this project?")) return
    await deleteProject({ projectId })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Code Agent</h1>
          <UserButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
          <p className="text-muted-foreground">
            Create and manage your React and Next.js projects
          </p>
        </div>

        <div className="grid gap-4">
          <button
            onClick={handleCreateProject}
            className="p-8 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <div className="text-lg font-semibold mb-1">
              + Create New Project
            </div>
            <div className="text-sm text-muted-foreground">
              Start a new React or Next.js project
            </div>
          </button>

          {projects === undefined ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              Loading...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              No projects yet. Create your first project to get started!
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project._id}
                className="p-6 border border-border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {project.framework === "react" ? "React" : "Next.js"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/project/${project._id}`}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => handleDeleteProject(project._id)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
