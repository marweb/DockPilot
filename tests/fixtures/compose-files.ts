/**
 * Docker Compose file fixtures for E2E testing
 * Provides various Docker Compose configurations for testing
 */

/**
 * Simple Nginx Compose configuration
 * Single service stack for basic testing
 */
export const simpleNginxCompose = `
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: compose-nginx
    ports:
      - "8889:80"
    environment:
      - NGINX_HOST=localhost
      - NGINX_PORT=80
    labels:
      - "test.suite=e2e"
      - "app.type=web-server"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
`;

/**
 * Redis Stack Compose configuration
 * Simple single-service Redis stack
 */
export const redisStackCompose = `
version: '3.8'

services:
  redis:
    image: redis:alpine
    container_name: compose-redis
    ports:
      - "6381:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    environment:
      - REDIS_PASSWORD=testpass123
    labels:
      - "test.suite=e2e"
      - "app.type=cache"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis-data:
    driver: local
`;

/**
 * Complex Application Stack
 * Multi-service stack with app, database, and cache
 */
export const complexAppStackCompose = `
version: '3.8'

services:
  app:
    image: node:20-alpine
    container_name: compose-app
    working_dir: /app
    command: sh -c "npm install && npm start"
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://testuser:testpass@db:5432/testdb
      - REDIS_URL=redis://cache:6379
      - API_KEY=test-api-key-12345
    volumes:
      - ./app:/app
      - node_modules:/app/node_modules
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks:
      - frontend
      - backend
    labels:
      - "test.suite=e2e"
      - "app.type=application"
      - "app.tier=frontend"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:15-alpine
    container_name: compose-db
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_USER=testuser
      - POSTGRES_PASSWORD=testpass
      - POSTGRES_DB=testdb
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - backend
    labels:
      - "test.suite=e2e"
      - "app.type=database"
      - "app.tier=data"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser -d testdb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  cache:
    image: redis:alpine
    container_name: compose-cache
    ports:
      - "6382:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-cache-data:/data
    networks:
      - backend
    labels:
      - "test.suite=e2e"
      - "app.type=cache"
      - "app.tier=data"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  worker:
    image: node:20-alpine
    container_name: compose-worker
    working_dir: /app
    command: sh -c "npm install && npm run worker"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://testuser:testpass@db:5432/testdb
      - REDIS_URL=redis://cache:6379
    volumes:
      - ./worker:/app
      - worker_node_modules:/app/node_modules
    depends_on:
      - db
      - cache
    networks:
      - backend
    labels:
      - "test.suite=e2e"
      - "app.type=worker"
      - "app.tier=backend"
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M

volumes:
  postgres-data:
    driver: local
  redis-cache-data:
    driver: local
  node_modules:
    driver: local
  worker_node_modules:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: false
`;

/**
 * WordPress Stack
 * WordPress with MySQL database
 */
export const wordpressStackCompose = `
version: '3.8'

services:
  wordpress:
    image: wordpress:latest
    container_name: compose-wordpress
    ports:
      - "8081:80"
    environment:
      - WORDPRESS_DB_HOST=wordpress-db:3306
      - WORDPRESS_DB_USER=wordpress
      - WORDPRESS_DB_PASSWORD=wordpresspass
      - WORDPRESS_DB_NAME=wordpress
    volumes:
      - wordpress-data:/var/www/html
    depends_on:
      - wordpress-db
    networks:
      - wordpress-network
    labels:
      - "test.suite=e2e"
      - "app.type=cms"
    restart: unless-stopped

  wordpress-db:
    image: mysql:8.0
    container_name: compose-wordpress-db
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass123
      - MYSQL_DATABASE=wordpress
      - MYSQL_USER=wordpress
      - MYSQL_PASSWORD=wordpresspass
    volumes:
      - wordpress-db-data:/var/lib/mysql
    networks:
      - wordpress-network
    labels:
      - "test.suite=e2e"
      - "app.type=database"
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password

volumes:
  wordpress-data:
    driver: local
  wordpress-db-data:
    driver: local

networks:
  wordpress-network:
    driver: bridge
`;

/**
 * Load Balancer Stack
 * Nginx load balancer with multiple backend services
 */
export const loadBalancerStackCompose = `
version: '3.8'

services:
  lb:
    image: nginx:alpine
    container_name: compose-lb
    ports:
      - "8090:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend-1
      - backend-2
      - backend-3
    networks:
      - lb-network
    labels:
      - "test.suite=e2e"
      - "app.type=load-balancer"
    restart: unless-stopped

  backend-1:
    image: httpd:alpine
    container_name: compose-backend-1
    environment:
      - BACKEND_ID=1
    networks:
      - lb-network
    labels:
      - "test.suite=e2e"
      - "app.type=backend"
      - "backend.id=1"
    restart: unless-stopped

  backend-2:
    image: httpd:alpine
    container_name: compose-backend-2
    environment:
      - BACKEND_ID=2
    networks:
      - lb-network
    labels:
      - "test.suite=e2e"
      - "app.type=backend"
      - "backend.id=2"
    restart: unless-stopped

  backend-3:
    image: httpd:alpine
    container_name: compose-backend-3
    environment:
      - BACKEND_ID=3
    networks:
      - lb-network
    labels:
      - "test.suite=e2e"
      - "app.type=backend"
      - "backend.id=3"
    restart: unless-stopped

networks:
  lb-network:
    driver: bridge
`;

/**
 * Invalid Compose - Syntax Error
 * Contains YAML syntax errors for testing error handling
 */
export const invalidSyntaxCompose = `
version: '3.8'

services:
  web:
    image nginx:latest
    ports:
      - "8080:80"
    environment
      - NODE_ENV=production
  
  # Missing indentation
  db:
  image: postgres:latest
    ports:
      - "5432:5432"
`;

/**
 * Invalid Compose - Invalid Image
 * References a non-existent image
 */
export const invalidImageCompose = `
version: '3.8'

services:
  app:
    image: this-image-definitely-does-not-exist:nonexistent-tag-xyz123
    container_name: invalid-image-test
    ports:
      - "9999:80"
    labels:
      - "test.suite=e2e"
      - "test.type=invalid-image"
`;

/**
 * Invalid Compose - Port Conflict
 * Services with conflicting port mappings
 */
export const portConflictCompose = `
version: '3.8'

services:
  web-1:
    image: nginx:alpine
    container_name: web-conflict-1
    ports:
      - "9090:80"
    labels:
      - "test.suite=e2e"

  web-2:
    image: nginx:alpine
    container_name: web-conflict-2
    ports:
      - "9090:80"  # Same host port as web-1
    labels:
      - "test.suite=e2e"
`;

/**
 * Invalid Compose - Circular Dependency
 * Services that depend on each other creating a deadlock
 */
export const circularDependencyCompose = `
version: '3.8'

services:
  service-a:
    image: alpine:latest
    container_name: circular-a
    command: sleep 3600
    depends_on:
      - service-b
    labels:
      - "test.suite=e2e"

  service-b:
    image: alpine:latest
    container_name: circular-b
    command: sleep 3600
    depends_on:
      - service-c
    labels:
      - "test.suite=e2e"

  service-c:
    image: alpine:latest
    container_name: circular-c
    command: sleep 3600
    depends_on:
      - service-a  # Creates circular dependency
    labels:
      - "test.suite=e2e"
`;

/**
 * Invalid Compose - Missing Required Field
 */
export const missingRequiredFieldCompose = `
version: '3.8'

services:
  web:
    # Missing 'image' or 'build' field
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
`;

/**
 * Compose file collection by category
 */
export const validComposeFiles = {
  simple: {
    nginx: simpleNginxCompose,
    redis: redisStackCompose,
  },
  complex: {
    appStack: complexAppStackCompose,
    wordpress: wordpressStackCompose,
    loadBalancer: loadBalancerStackCompose,
  },
};

export const invalidComposeFiles = {
  syntax: invalidSyntaxCompose,
  image: invalidImageCompose,
  ports: portConflictCompose,
  dependency: circularDependencyCompose,
  required: missingRequiredFieldCompose,
};

/**
 * All compose files
 */
export const allComposeFiles = {
  ...validComposeFiles.simple,
  ...validComposeFiles.complex,
  ...invalidComposeFiles,
};

/**
 * Helper to save compose file to disk
 */
export function getComposeContent(name: keyof typeof allComposeFiles): string {
  return allComposeFiles[name] || '';
}

/**
 * Get compose file by name
 */
export function getComposeFile(name: string): string | undefined {
  return allComposeFiles[name as keyof typeof allComposeFiles];
}

/**
 * List all available compose file names
 */
export function listComposeFiles(): { valid: string[]; invalid: string[] } {
  return {
    valid: [...Object.keys(validComposeFiles.simple), ...Object.keys(validComposeFiles.complex)],
    invalid: Object.keys(invalidComposeFiles),
  };
}

/**
 * Validate compose file structure (basic validation)
 */
export function validateComposeStructure(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for version
  if (!content.includes('version:')) {
    errors.push('Missing version declaration');
  }

  // Check for services
  if (!content.includes('services:')) {
    errors.push('Missing services section');
  }

  // Basic YAML syntax checks
  const lines = content.split('\n');
  let inServices = false;
  let serviceIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === 'services:') {
      inServices = true;
      serviceIndent = line.search(/\S/);
      continue;
    }

    if (inServices && trimmed && !trimmed.startsWith('#')) {
      const currentIndent = line.search(/\S/);

      // Service names should be indented under services
      if (currentIndent <= serviceIndent && trimmed.includes(':')) {
        inServices = false;
      }
    }

    // Check for common syntax errors
    if (trimmed.includes(': ') && !trimmed.startsWith('-')) {
      const colonIndex = trimmed.indexOf(':');
      const afterColon = trimmed.substring(colonIndex + 1).trim();

      // Missing space after colon in some contexts
      if (
        afterColon &&
        !afterColon.startsWith(' ') &&
        !afterColon.startsWith("'") &&
        !afterColon.startsWith('"') &&
        !['true', 'false', 'null', '[', '{'].some((v) => afterColon.startsWith(v))
      ) {
        errors.push(`Line ${i + 1}: Possible syntax error near colon`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create compose file with custom service names
 */
export function customizeComposeNames(
  composeContent: string,
  nameMapping: Record<string, string>
): string {
  let customized = composeContent;

  for (const [oldName, newName] of Object.entries(nameMapping)) {
    // Replace service names (be careful with the pattern)
    const servicePattern = new RegExp(`^  ${oldName}:`, 'gm');
    customized = customized.replace(servicePattern, `  ${newName}:`);

    // Replace container_name references
    const containerPattern = new RegExp(`container_name: ${oldName}`, 'g');
    customized = customized.replace(containerPattern, `container_name: ${newName}`);

    // Replace depends_on references
    const dependsPattern = new RegExp(`- ${oldName}$`, 'gm');
    customized = customized.replace(dependsPattern, `- ${newName}`);
  }

  return customized;
}

export default {
  simpleNginxCompose,
  redisStackCompose,
  complexAppStackCompose,
  wordpressStackCompose,
  loadBalancerStackCompose,
  invalidSyntaxCompose,
  invalidImageCompose,
  portConflictCompose,
  circularDependencyCompose,
  missingRequiredFieldCompose,
  validComposeFiles,
  invalidComposeFiles,
  allComposeFiles,
  getComposeContent,
  getComposeFile,
  listComposeFiles,
  validateComposeStructure,
  customizeComposeNames,
};
