# Azure Deployment for Eagle Notifier Backend

## Implementation Details

- Created Dockerfile for containerizing the Node.js backend
- Added docker-compose.yml for local testing
- Created PowerShell deployment script (deploy-azure.ps1)
- Added .dockerignore to optimize container builds

## Deployment Options

### Option 1: Direct Deployment (Fastest initial setup)
Good for quick development testing:
```
az webapp up --sku F1 --name eagle-notifier-backend --location eastus --os-type Linux --runtime "NODE|18-lts"
```

### Option 2: Container Deployment (Recommended for production)
Better for consistent environments and scaling:
1. Build and push container to Azure Container Registry
2. Deploy as App Service with container configuration

## Deployment Steps

1. Install Azure CLI:
   ```
   winget install -e --id Microsoft.AzureCLI
   ```

2. Log in to Azure:
   ```
   az login
   ```

3. For container deployment:
   ```
   cd backend
   ./deploy-azure.ps1
   ```

4. For direct code deployment:
   ```
   cd backend
   az webapp up --sku F1 --name eagle-notifier-backend --location eastus --os-type Linux --runtime "NODE|18-lts"
   ```

## Environment Variables
Configure environment variables in Azure App Service:
- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- NODE_ENV (set to "production")
- PORT
- RATE_LIMIT_WINDOW_MS
- RATE_LIMIT_MAX

## Security Considerations
- Ensure DATABASE_URL is properly secured using Azure Key Vault for production
- Set up Azure Application Insights for monitoring
- Configure SSL/TLS on your App Service

## Performance Optimizations
- Use Azure Blob Storage for storing static files
- Consider Azure Cache for Redis if needed for caching
- For high traffic: Scale up App Service Plan or enable auto-scaling 