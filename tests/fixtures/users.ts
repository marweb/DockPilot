/**
 * Test user fixtures for E2E testing
 * Provides different user types with various permission levels
 */

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  permissions: string[];
  token?: string;
  refreshToken?: string;
}

/**
 * Admin user with full permissions
 */
export const adminUser: TestUser = {
  id: 'user-admin-001',
  username: 'admin',
  email: 'admin@dockpilot.local',
  password: 'Admin123!Test',
  role: 'admin',
  firstName: 'System',
  lastName: 'Administrator',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  permissions: [
    'containers:read',
    'containers:write',
    'containers:delete',
    'images:read',
    'images:write',
    'images:delete',
    'networks:read',
    'networks:write',
    'networks:delete',
    'volumes:read',
    'volumes:write',
    'volumes:delete',
    'tunnels:read',
    'tunnels:write',
    'tunnels:delete',
    'users:read',
    'users:write',
    'users:delete',
    'settings:read',
    'settings:write',
    'logs:read',
    'logs:write',
    'compose:read',
    'compose:write',
    'compose:deploy',
  ],
};

/**
 * Operator user with limited permissions (no user management)
 */
export const operatorUser: TestUser = {
  id: 'user-operator-001',
  username: 'operator',
  email: 'operator@dockpilot.local',
  password: 'Operator123!Test',
  role: 'operator',
  firstName: 'Docker',
  lastName: 'Operator',
  isActive: true,
  createdAt: new Date('2024-01-02'),
  permissions: [
    'containers:read',
    'containers:write',
    'containers:delete',
    'images:read',
    'images:write',
    'networks:read',
    'networks:write',
    'volumes:read',
    'volumes:write',
    'tunnels:read',
    'tunnels:write',
    'logs:read',
    'compose:read',
    'compose:write',
    'compose:deploy',
  ],
};

/**
 * Viewer user with read-only permissions
 */
export const viewerUser: TestUser = {
  id: 'user-viewer-001',
  username: 'viewer',
  email: 'viewer@dockpilot.local',
  password: 'Viewer123!Test',
  role: 'viewer',
  firstName: 'Read',
  lastName: 'Only',
  isActive: true,
  createdAt: new Date('2024-01-03'),
  permissions: [
    'containers:read',
    'images:read',
    'networks:read',
    'volumes:read',
    'tunnels:read',
    'logs:read',
    'compose:read',
  ],
};

/**
 * Inactive user (cannot login)
 */
export const inactiveUser: TestUser = {
  id: 'user-inactive-001',
  username: 'inactive',
  email: 'inactive@dockpilot.local',
  password: 'Inactive123!Test',
  role: 'viewer',
  firstName: 'Inactive',
  lastName: 'User',
  isActive: false,
  createdAt: new Date('2024-01-04'),
  permissions: [],
};

/**
 * All predefined test users
 */
export const testUsers: TestUser[] = [adminUser, operatorUser, viewerUser, inactiveUser];

/**
 * Get user by role
 */
export function getUserByRole(role: UserRole): TestUser | undefined {
  return testUsers.find((user) => user.role === role && user.isActive);
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): TestUser | undefined {
  return testUsers.find((user) => user.username === username);
}

/**
 * Get all users by role
 */
export function getUsersByRole(role: UserRole): TestUser[] {
  return testUsers.filter((user) => user.role === role);
}

/**
 * Get only active users
 */
export function getActiveUsers(): TestUser[] {
  return testUsers.filter((user) => user.isActive);
}

/**
 * Random user data generator
 */
interface RandomUserOptions {
  role?: UserRole;
  prefix?: string;
}

export function generateRandomUser(options: RandomUserOptions = {}): TestUser {
  const { role = 'viewer', prefix = 'test' } = options;
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const randomStr = Math.random().toString(36).substring(2, 8);

  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Edward', 'Fiona'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  return {
    id: `user-${prefix}-${timestamp}-${random}`,
    username: `${prefix}-user-${randomStr}`,
    email: `${prefix}-${randomStr}@dockpilot.local`,
    password: `TestPass${random}!Xy9`,
    role,
    firstName,
    lastName,
    isActive: true,
    createdAt: new Date(),
    permissions: getDefaultPermissions(role),
  };
}

/**
 * Get default permissions for a role
 */
function getDefaultPermissions(role: UserRole): string[] {
  const permissionMap: Record<UserRole, string[]> = {
    admin: [
      'containers:read',
      'containers:write',
      'containers:delete',
      'images:read',
      'images:write',
      'images:delete',
      'networks:read',
      'networks:write',
      'networks:delete',
      'volumes:read',
      'volumes:write',
      'volumes:delete',
      'tunnels:read',
      'tunnels:write',
      'tunnels:delete',
      'users:read',
      'users:write',
      'users:delete',
      'settings:read',
      'settings:write',
      'logs:read',
      'logs:write',
      'compose:read',
      'compose:write',
      'compose:deploy',
    ],
    operator: [
      'containers:read',
      'containers:write',
      'containers:delete',
      'images:read',
      'images:write',
      'networks:read',
      'networks:write',
      'volumes:read',
      'volumes:write',
      'tunnels:read',
      'tunnels:write',
      'logs:read',
      'compose:read',
      'compose:write',
      'compose:deploy',
    ],
    viewer: [
      'containers:read',
      'images:read',
      'networks:read',
      'volumes:read',
      'tunnels:read',
      'logs:read',
      'compose:read',
    ],
  };

  return permissionMap[role];
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: TestUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(user: TestUser, permissions: string[]): boolean {
  return permissions.every((permission) => user.permissions.includes(permission));
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: TestUser, permissions: string[]): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}

/**
 * Authentication tokens for testing
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Generate mock auth tokens
 */
export function generateMockTokens(user: TestUser): AuthTokens {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };

  // Base64 encoded mock JWT (not valid for actual auth)
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const mockSignature = 'mock_signature_for_testing_only';

  return {
    accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.${mockSignature}`,
    refreshToken: `refresh-${user.id}-${Date.now()}`,
    expiresIn: 900,
    tokenType: 'Bearer',
  };
}

/**
 * Predefined auth tokens for testing
 */
export const mockAuthTokens: Record<UserRole, AuthTokens> = {
  admin: generateMockTokens(adminUser),
  operator: generateMockTokens(operatorUser),
  viewer: generateMockTokens(viewerUser),
};

/**
 * Create authentication header
 */
export function createAuthHeader(tokens: AuthTokens): Record<string, string> {
  return {
    Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
  };
}

/**
 * Login credentials for API testing
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Get login credentials for a user
 */
export function getLoginCredentials(user: TestUser): LoginCredentials {
  return {
    username: user.username,
    password: user.password,
  };
}

/**
 * All login credentials for testing
 */
export const loginCredentials: Record<string, LoginCredentials> = {
  admin: getLoginCredentials(adminUser),
  operator: getLoginCredentials(operatorUser),
  viewer: getLoginCredentials(viewerUser),
  inactive: getLoginCredentials(inactiveUser),
};

export default {
  adminUser,
  operatorUser,
  viewerUser,
  inactiveUser,
  testUsers,
  getUserByRole,
  getUserByUsername,
  getUsersByRole,
  getActiveUsers,
  generateRandomUser,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  generateMockTokens,
  mockAuthTokens,
  createAuthHeader,
  getLoginCredentials,
  loginCredentials,
};
