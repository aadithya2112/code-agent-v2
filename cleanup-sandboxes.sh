#!/bin/bash

# Cleanup script to kill all E2B sandboxes
# Run this when you have orphaned sandboxes

echo "Cleaning up all E2B sandboxes..."

# This uses the Convex CLI to run the cleanup action
bunx convex run cleanup:killAllSandboxes

echo "Done!"
