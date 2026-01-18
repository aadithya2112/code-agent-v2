import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default function LandingPage() {
  return (
    <>
      <SignedIn>{redirect("/dashboard")}</SignedIn>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full space-y-8 text-center px-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Code Agent</h1>
              <p className="text-muted-foreground text-lg">
                Build React and Next.js apps with AI assistance
              </p>
            </div>

            <div className="flex gap-4 justify-center pt-8">
              <SignInButton mode="modal">
                <button className="px-6 py-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  Get Started
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>
    </>
  )
}
