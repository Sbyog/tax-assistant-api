#!/bin/zsh

# Script to deploy to Google Cloud Run

# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GITIGNORE_PATH="$SCRIPT_DIR/.gitignore"

echo "Commenting out .env in .gitignore..."
# Use a temporary file for sed compatibility on macOS
sed -i '.bak' 's|^.env$|# .env|' "$GITIGNORE_PATH"
if [ -f "$GITIGNORE_PATH.bak" ]; then
    rm "$GITIGNORE_PATH.bak"
fi

echo "Deploying to Google Cloud Run..."
# IMPORTANT: Replace YOUR_PROJECT_ID with your actual Google Cloud Project ID
gcloud run deploy tax-assistant-api \
    --source . \
    --region asia-southeast1 \
    --allow-unauthenticated

DEPLOY_STATUS=$?

echo "Uncommenting .env in .gitignore..."
# Use a temporary file for sed compatibility on macOS
sed -i '.bak' 's|^# .env$|.env|' "$GITIGNORE_PATH"
if [ -f "$GITIGNORE_PATH.bak" ]; then
    rm "$GITIGNORE_PATH.bak"
fi

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo "Deployment successful!"
else
  echo "Deployment failed. Please check the output above."
fi

exit $DEPLOY_STATUS
