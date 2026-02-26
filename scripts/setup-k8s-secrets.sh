#!/bin/bash
set -euo pipefail

NAMESPACE="${1:-table-planner}"
GITHUB_PAT="${GITHUB_PAT:-}"

echo "=== Table Planner K8s Setup ==="
echo "Namespace: $NAMESPACE"
echo ""

# Create namespace if it doesn't exist
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# 1. Image pull secret
if [ -z "$GITHUB_PAT" ]; then
  echo "Skipping ghcr-pull-secret (set GITHUB_PAT env var to create it)"
else
  echo "Creating ghcr-pull-secret..."
  kubectl create secret docker-registry ghcr-pull-secret \
    --docker-server=ghcr.io \
    --docker-username=frallan97 \
    --docker-password="$GITHUB_PAT" \
    --namespace="$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "  -> ghcr-pull-secret created"
fi

# 2. Database secret
if kubectl get secret table-planner-db-secret -n "$NAMESPACE" &>/dev/null; then
  echo "Database secret already exists, skipping..."
else
  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
  DB_URL="postgresql://tableplanner:${DB_PASSWORD}@table-planner-postgresql:5432/tableplanner?sslmode=disable"

  echo "Creating table-planner-db-secret..."
  kubectl create secret generic table-planner-db-secret \
    --from-literal=password="$DB_PASSWORD" \
    --from-literal=database-url="$DB_URL" \
    --namespace="$NAMESPACE"
  echo "  -> table-planner-db-secret created"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "IMPORTANT: Register the app in the auth-service database:"
echo ""
echo "  INSERT INTO applications (name, origin, redirect_uris, is_active)"
echo "  VALUES ("
echo "    'Table Planner',"
echo "    'https://table.vibeoholic.com',"
echo "    ARRAY['https://table.vibeoholic.com/auth/callback'],"
echo "    true"
echo "  );"
echo ""
echo "Then deploy with:"
echo "  helm upgrade --install table-planner ./charts/table-planner -n $NAMESPACE"
