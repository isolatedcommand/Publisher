#!/bin/bash

# 1. Define the module path and get current directory name
MODULE_PATH="github.com/isolatedcommand/Publisher"
CURRENT_DIR_NAME=$(basename "$PWD")

# 2. Get the current latest tag to show the user
CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null)
echo "Current Publisher version is: ${CURRENT_TAG:-None}"
echo "---------------------------------------------------"

# 3. Prompt the user for the NEW version tag
read -p "Enter the NEW tag version (e.g., v0.13.3): " NEW_TAG
if [ -z "$NEW_TAG" ]; then
    echo "❌ Error: Tag version cannot be empty."
    exit 1
fi

# 4. Prompt the user for the commit message
read -p "Enter the commit message: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    echo "❌ Error: Commit message cannot be empty."
    exit 1
fi

# 5. Execute Git operations for the Design System
echo "---------------------------------------------------"
echo "📦 Committing and pushing Publisher updates..."
git add .
git commit -m "$COMMIT_MSG"
git push

echo "🏷️  Tagging as $NEW_TAG and pushing tag..."
git tag "$NEW_TAG"
git push origin "$NEW_TAG"
echo "✅ Publisher successfully published as $NEW_TAG!"

# 6. Auto-detect and update all child sites in ../
echo "---------------------------------------------------"
echo "🔍 Scanning parent directory for child sites..."

for CHILD_DIR in ../*/; do
    # Get just the folder name 
    DIR_NAME=$(basename "$CHILD_DIR")
    
    # Skip the Publisher repo itself (so it doesn't try to update itself)
    if [ "$DIR_NAME" == "$CURRENT_DIR_NAME" ]; then
        continue
    fi

    # Safety check: Only run if the folder has a go.mod file
    if [ -f "${CHILD_DIR}go.mod" ]; then
        echo "---------------------------------------------------"
        echo "🚀 Updating child site: $DIR_NAME"
        
        cd "$CHILD_DIR" || continue
        
        # Pull the new version
        hugo mod get "${MODULE_PATH}@${NEW_TAG}"
        hugo mod tidy
        
        # Return to Publisher repo
        cd - > /dev/null
    else
        echo "⏭️  Skipping '$DIR_NAME': No go.mod found."
    fi
done

echo "---------------------------------------------------"
echo "🎉 All done! Design system published and all valid child sites updated to $NEW_TAG."