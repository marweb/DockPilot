# Cloudflare Tunnel Control - Error Documentation

## Common Error Codes

### Authentication Errors

#### `NOT_AUTHENTICATED` (401)

**Cause**: No valid Cloudflare authentication found.

**Solutions**:

1. Login using API token:

   ```bash
   curl -X POST http://localhost:3002/api/tunnels/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "apiToken": "your-api-token",
       "accountId": "your-account-id"
     }'
   ```

2. Or use OAuth login:
   ```bash
   curl -X POST http://localhost:3002/api/tunnels/auth/login/oauth
   ```

#### `AUTH_FAILED` (400/401)

**Cause**: Invalid API token or account ID.

**Solutions**:

- Verify your API token has the necessary permissions
- Ensure the account ID is correct (32 character hex string)
- Check that the token has `Cloudflare Tunnel:Edit` permission

### Tunnel Errors

#### `TUNNEL_NOT_FOUND` (404)

**Cause**: The requested tunnel ID doesn't exist.

**Solutions**:

- List all tunnels to find the correct ID:
  ```bash
  curl http://localhost:3002/api/tunnels
  ```
- Verify the tunnel ID format (UUID v4)

#### `TUNNEL_ALREADY_EXISTS` (409)

**Cause**: Attempted to create a tunnel with a name that already exists.

**Solutions**:

- Use a different tunnel name
- Delete the existing tunnel first:
  ```bash
  curl -X DELETE http://localhost:3002/api/tunnels/{id}
  ```

#### `START_ERROR` (400)

**Cause**: Failed to start the tunnel process.

**Common Causes**:

- Tunnel credentials file is missing or corrupted
- Cloudflared binary not found
- Port already in use
- Insufficient permissions

**Solutions**:

1. Verify cloudflared is installed:

   ```bash
   curl http://localhost:3002/api/health
   ```

2. Check tunnel credentials exist:

   ```bash
   curl http://localhost:3002/api/tunnels/{id}
   ```

3. Check tunnel logs for details:
   ```bash
   curl http://localhost:3002/api/tunnels/{id}/logs?lines=50
   ```

### Ingress Rule Errors

#### `INGRESS_RULE_ERROR` (400)

**Cause**: Invalid ingress rule configuration.

**Common Issues**:

- Invalid hostname format
- Service URL not properly formatted
- Missing required fields

**Solutions**:

- Hostname must be a valid domain name
- Service must be a valid URL (e.g., `http://localhost:8080`)
- Required fields: `hostname`, `service`

Example valid ingress rule:

```json
{
  "hostname": "app.example.com",
  "service": "http://localhost:3000",
  "path": "/api"
}
```

### API Errors

#### `CLOUDFLARE_ERROR` (4xx/5xx)

**Cause**: Error returned from Cloudflare API.

**Common Status Codes**:

- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (invalid API token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `429` - Rate limited (too many requests)
- `500` - Cloudflare internal error

**Solutions**:

- Check your API token permissions
- Verify you're not exceeding rate limits
- Review Cloudflare API documentation

#### `RATE_LIMITED` (429)

**Cause**: Too many requests to Cloudflare API.

**Solutions**:

- Wait before retrying
- Implement exponential backoff
- Check rate limit headers in response

### System Errors

#### `PROCESS_ERROR` (500)

**Cause**: Failed to execute cloudflared process.

**Common Causes**:

- cloudflared binary not found at configured path
- Insufficient permissions to execute binary
- Missing system dependencies

**Solutions**:

1. Verify cloudflared installation:

   ```bash
   which cloudflared
   cloudflared --version
   ```

2. Update configuration if needed:
   ```bash
   export CLOUDFLARED_PATH=/path/to/cloudflared
   ```

#### `VALIDATION_ERROR` (400)

**Cause**: Request body failed validation.

**Solutions**:

- Check the response for specific validation errors
- Ensure all required fields are present
- Verify data types match the schema

## Debugging Tips

### Check Service Health

```bash
# Overall health
curl http://localhost:3002/api/health

# Liveness check
curl http://localhost:3002/api/healthz

# Detailed status
curl http://localhost:3002/api/status
```

### View Tunnel Logs

```bash
# Get recent logs
curl http://localhost:3002/api/tunnels/{id}/logs

# Get more lines
curl http://localhost:3002/api/tunnels/{id}/logs?lines=500
```

### Check Authentication Status

```bash
curl http://localhost:3002/api/tunnels/auth/status
```

### Common Log Messages

#### "cloudflared binary not found"

- **Meaning**: The configured cloudflared path doesn't exist
- **Fix**: Install cloudflared or update `CLOUDFLARED_PATH`

#### "Not authenticated with Cloudflare"

- **Meaning**: No valid authentication found
- **Fix**: Run the login endpoint

#### "Tunnel process exited with code X"

- **Meaning**: The tunnel process crashed
- **Fix**: Check logs for error details, verify configuration

#### "Max restarts reached"

- **Meaning**: Tunnel crashed too many times
- **Fix**: Check configuration and logs for root cause

## Environment Variables

### Required

- `CLOUDFLARED_PATH` - Path to cloudflared binary
- `CREDENTIALS_DIR` - Directory to store tunnel credentials

### Optional

- `ENCRYPTION_KEY` - Key for encrypting stored credentials
- `METRICS_PORT` - Port for tunnel metrics endpoint
- `MAX_RESTARTS` - Maximum auto-restart attempts (default: 3)
- `RESTART_DELAY` - Delay between restarts in ms (default: 5000)
- `LOG_LEVEL` - Logging level (trace, debug, info, warn, error, fatal)
- `LOG_FILE` - File to write logs to

## Getting Help

If you encounter an error not documented here:

1. Check the service logs for detailed error messages
2. Verify your configuration and environment variables
3. Ensure all dependencies are properly installed
4. Check Cloudflare's status page for API outages
5. Review the cloudflared documentation
