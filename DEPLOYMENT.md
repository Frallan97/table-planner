# Table Planner - Deployment Guide

This document provides instructions for deploying the Table Planner application to the Kubernetes cluster via ArgoCD.

## Prerequisites

- GitHub repository: https://github.com/Frallan97/table-planner
- Access to the k3s cluster (37.27.40.86)
- Access to the k3s-infra repository
- GitHub Personal Access Token with `read:packages` permission

## Deployment Steps

### 1. Build and Push Docker Image

The GitHub Actions workflow will automatically build and push the Docker image when you push to the `main` branch.

You can also manually trigger the workflow:
```bash
gh workflow run docker-build.yml
```

Check the workflow status:
```bash
gh run list --workflow=docker-build.yml
```

The image will be pushed to: `ghcr.io/frallan97/table-planner:latest`

### 2. Create Namespace and Image Pull Secret

SSH into the Kubernetes cluster and create the namespace:

```bash
ssh -i /home/frans-sjostrom/.ssh/hetzner-deploy root@37.27.40.86

# Create namespace
kubectl create namespace table-planner

# Create image pull secret
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=frallan97 \
  --docker-password=<YOUR_GITHUB_PAT> \
  --namespace=table-planner

# Verify secret was created
kubectl get secrets -n table-planner
```

**Note:** Replace `<YOUR_GITHUB_PAT>` with your actual GitHub Personal Access Token.

### 3. Configure DNS

The application will be available at `table.vibeoholic.com`. Ensure the DNS record is configured:

```bash
# The DNS should point to your Traefik ingress controller
# This is typically already configured for *.vibeoholic.com
```

If you need to add/verify the DNS record, check your Cloudflare settings.

### 4. Add Application to ArgoCD

Navigate to your k3s-infra repository and edit the ArgoCD ApplicationSet:

```bash
cd /path/to/k3s-infra
```

Edit `clusters/main/apps/app-of-apps.yaml` and add:

```yaml
- name: table-planner
  repoURL: https://github.com/Frallan97/table-planner.git
  targetRevision: main
  path: charts/table-planner
  namespace: table-planner
```

Commit and push the changes:

```bash
git add clusters/main/apps/app-of-apps.yaml
git commit -m "Add table-planner application to ArgoCD"
git push
```

ArgoCD will automatically detect the changes and deploy the application.

### 5. Verify Deployment

Check the ArgoCD UI:
- URL: https://argocd.vibeoholic.com
- Look for the `table-planner` application
- Verify it's synced and healthy

Check the deployment status on the cluster:

```bash
# Check pods
kubectl get pods -n table-planner

# Check services
kubectl get svc -n table-planner

# Check ingress
kubectl get ingress -n table-planner

# Check logs
kubectl logs -n table-planner -l app.kubernetes.io/name=table-planner
```

### 6. Access the Application

Once deployed, access the application at:
- **URL:** https://table.vibeoholic.com

## Troubleshooting

### Image Pull Errors

If you see `ImagePullBackOff` errors:

```bash
# Check if the secret exists
kubectl get secrets -n table-planner

# Verify the secret is correctly configured
kubectl describe secret ghcr-pull-secret -n table-planner

# Check pod events
kubectl describe pod <pod-name> -n table-planner
```

### Ingress Issues

If the domain is not accessible:

```bash
# Check ingress status
kubectl get ingress -n table-planner
kubectl describe ingress -n table-planner

# Check Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik

# Verify cert-manager certificate
kubectl get certificate -n table-planner
kubectl describe certificate table-planner-tls -n table-planner
```

### Application Not Syncing in ArgoCD

If ArgoCD doesn't pick up the changes:

```bash
# Manually sync via ArgoCD CLI
argocd app sync table-planner

# Or refresh the app
argocd app get table-planner --refresh
```

## Configuration Updates

### Updating the Application

To update the application:

1. Make changes to your code
2. Commit and push to the `main` branch
3. GitHub Actions will build and push a new image
4. ArgoCD will automatically detect and deploy the update (if auto-sync is enabled)
5. If auto-sync is not enabled, manually sync in the ArgoCD UI

### Scaling

To change the number of replicas, edit `charts/table-planner/values.yaml`:

```yaml
replicaCount: 3  # Change this value
```

Commit and push the change.

### Resource Limits

To adjust resource limits, edit `charts/table-planner/values.yaml`:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

## Maintenance

### Viewing Logs

```bash
# Real-time logs
kubectl logs -f -n table-planner -l app.kubernetes.io/name=table-planner

# Logs from all pods
kubectl logs -n table-planner --all-containers=true -l app.kubernetes.io/name=table-planner
```

### Restarting the Application

```bash
kubectl rollout restart deployment -n table-planner
```

### Deleting the Application

To remove the application:

```bash
# Remove from ArgoCD (edit app-of-apps.yaml)
# Then delete the namespace
kubectl delete namespace table-planner
```

## Architecture

- **Frontend:** Bun + React + TypeScript
- **Web Server:** Nginx (serves static files)
- **Container Registry:** ghcr.io/frallan97/table-planner
- **Ingress:** Traefik with Let's Encrypt TLS
- **Domain:** table.vibeoholic.com
- **Replicas:** 2 (for high availability)

## Resources

- Repository: https://github.com/Frallan97/table-planner
- ArgoCD: https://argocd.vibeoholic.com
- Application URL: https://table.vibeoholic.com
