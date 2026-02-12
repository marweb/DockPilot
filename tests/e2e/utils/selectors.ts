/**
 * Centralized selectors for E2E tests
 * All selectors are defined here to maintain consistency and ease maintenance
 */

// ============================================================================
// Data Test ID Selectors
// ============================================================================

export const DataTestId = {
  // Navigation
  NAV_SIDEBAR: '[data-testid="nav-sidebar"]',
  NAV_LINK: '[data-testid="nav-link"]',
  NAV_LINK_CONTAINERS: '[data-testid="nav-link-containers"]',
  NAV_LINK_IMAGES: '[data-testid="nav-link-images"]',
  NAV_LINK_NETWORKS: '[data-testid="nav-link-networks"]',
  NAV_LINK_VOLUMES: '[data-testid="nav-link-volumes"]',
  NAV_LINK_TUNNELS: '[data-testid="nav-link-tunnels"]',
  NAV_LINK_LOGS: '[data-testid="nav-link-logs"]',
  NAV_LINK_SETTINGS: '[data-testid="nav-link-settings"]',

  // Header
  HEADER: '[data-testid="header"]',
  HEADER_TITLE: '[data-testid="header-title"]',
  HEADER_USER_MENU: '[data-testid="header-user-menu"]',
  HEADER_NOTIFICATIONS: '[data-testid="header-notifications"]',

  // Containers List
  CONTAINERS_PAGE: '[data-testid="containers-page"]',
  CONTAINERS_LIST: '[data-testid="containers-list"]',
  CONTAINER_CARD: '[data-testid="container-card"]',
  CONTAINER_ROW: '[data-testid="container-row"]',
  CONTAINER_NAME: '[data-testid="container-name"]',
  CONTAINER_STATUS: '[data-testid="container-status"]',
  CONTAINER_IMAGE: '[data-testid="container-image"]',
  CONTAINER_PORTS: '[data-testid="container-ports"]',
  CONTAINER_ACTIONS: '[data-testid="container-actions"]',
  CONTAINER_START_BTN: '[data-testid="container-start-btn"]',
  CONTAINER_STOP_BTN: '[data-testid="container-stop-btn"]',
  CONTAINER_RESTART_BTN: '[data-testid="container-restart-btn"]',
  CONTAINER_DELETE_BTN: '[data-testid="container-delete-btn"]',
  CONTAINER_LOGS_BTN: '[data-testid="container-logs-btn"]',

  // Container Details
  CONTAINER_DETAILS_PAGE: '[data-testid="container-details-page"]',
  CONTAINER_DETAILS_TABS: '[data-testid="container-details-tabs"]',
  CONTAINER_DETAILS_OVERVIEW: '[data-testid="container-details-overview"]',
  CONTAINER_DETAILS_LOGS: '[data-testid="container-details-logs"]',
  CONTAINER_DETAILS_STATS: '[data-testid="container-details-stats"]',
  CONTAINER_DETAILS_ENV: '[data-testid="container-details-env"]',
  CONTAINER_DETAILS_VOLUMES: '[data-testid="container-details-volumes"]',

  // Create Container
  CREATE_CONTAINER_PAGE: '[data-testid="create-container-page"]',
  CREATE_CONTAINER_FORM: '[data-testid="create-container-form"]',
  CREATE_CONTAINER_NAME_INPUT: '[data-testid="create-container-name-input"]',
  CREATE_CONTAINER_IMAGE_INPUT: '[data-testid="create-container-image-input"]',
  CREATE_CONTAINER_COMMAND_INPUT: '[data-testid="create-container-command-input"]',
  CREATE_CONTAINER_PORT_MAPPING: '[data-testid="create-container-port-mapping"]',
  CREATE_CONTAINER_ENV_VARS: '[data-testid="create-container-env-vars"]',
  CREATE_CONTAINER_VOLUMES: '[data-testid="create-container-volumes"]',
  CREATE_CONTAINER_SUBMIT_BTN: '[data-testid="create-container-submit-btn"]',
  CREATE_CONTAINER_CANCEL_BTN: '[data-testid="create-container-cancel-btn"]',

  // Images
  IMAGES_PAGE: '[data-testid="images-page"]',
  IMAGES_LIST: '[data-testid="images-list"]',
  IMAGE_CARD: '[data-testid="image-card"]',
  IMAGE_NAME: '[data-testid="image-name"]',
  IMAGE_TAG: '[data-testid="image-tag"]',
  IMAGE_SIZE: '[data-testid="image-size"]',
  IMAGE_PULL_BTN: '[data-testid="image-pull-btn"]',
  IMAGE_DELETE_BTN: '[data-testid="image-delete-btn"]',

  // Networks
  NETWORKS_PAGE: '[data-testid="networks-page"]',
  NETWORKS_LIST: '[data-testid="networks-list"]',
  NETWORK_CARD: '[data-testid="network-card"]',
  NETWORK_NAME: '[data-testid="network-name"]',
  NETWORK_DRIVER: '[data-testid="network-driver"]',

  // Volumes
  VOLUMES_PAGE: '[data-testid="volumes-page"]',
  VOLUMES_LIST: '[data-testid="volumes-list"]',
  VOLUME_CARD: '[data-testid="volume-card"]',
  VOLUME_NAME: '[data-testid="volume-name"]',
  VOLUME_SIZE: '[data-testid="volume-size"]',

  // Tunnels
  TUNNELS_PAGE: '[data-testid="tunnels-page"]',
  TUNNELS_LIST: '[data-testid="tunnels-list"]',
  TUNNEL_CARD: '[data-testid="tunnel-card"]',
  TUNNEL_NAME: '[data-testid="tunnel-name"]',
  TUNNEL_STATUS: '[data-testid="tunnel-status"]',
  TUNNEL_URL: '[data-testid="tunnel-url"]',

  // Compose
  COMPOSE_PAGE: '[data-testid="compose-page"]',
  COMPOSE_EDITOR: '[data-testid="compose-editor"]',
  COMPOSE_UPLOAD_BTN: '[data-testid="compose-upload-btn"]',
  COMPOSE_DEPLOY_BTN: '[data-testid="compose-deploy-btn"]',

  // Common Components
  BUTTON: '[data-testid="button"]',
  BUTTON_PRIMARY: '[data-testid="button-primary"]',
  BUTTON_SECONDARY: '[data-testid="button-secondary"]',
  BUTTON_DANGER: '[data-testid="button-danger"]',
  BUTTON_GHOST: '[data-testid="button-ghost"]',

  INPUT: '[data-testid="input"]',
  INPUT_TEXT: '[data-testid="input-text"]',
  INPUT_NUMBER: '[data-testid="input-number"]',
  INPUT_SEARCH: '[data-testid="input-search"]',
  INPUT_SELECT: '[data-testid="input-select"]',
  INPUT_TEXTAREA: '[data-testid="input-textarea"]',

  MODAL: '[data-testid="modal"]',
  MODAL_HEADER: '[data-testid="modal-header"]',
  MODAL_BODY: '[data-testid="modal-body"]',
  MODAL_FOOTER: '[data-testid="modal-footer"]',
  MODAL_CLOSE_BTN: '[data-testid="modal-close-btn"]',
  MODAL_CONFIRM_BTN: '[data-testid="modal-confirm-btn"]',
  MODAL_CANCEL_BTN: '[data-testid="modal-cancel-btn"]',

  DROPDOWN: '[data-testid="dropdown"]',
  DROPDOWN_TRIGGER: '[data-testid="dropdown-trigger"]',
  DROPDOWN_MENU: '[data-testid="dropdown-menu"]',
  DROPDOWN_ITEM: '[data-testid="dropdown-item"]',

  TOOLTIP: '[data-testid="tooltip"]',
  TOOLTIP_TRIGGER: '[data-testid="tooltip-trigger"]',

  // Toast Notifications
  TOAST: '[data-testid="toast"]',
  TOAST_SUCCESS: '[data-testid="toast-success"]',
  TOAST_ERROR: '[data-testid="toast-error"]',
  TOAST_WARNING: '[data-testid="toast-warning"]',
  TOAST_INFO: '[data-testid="toast-info"]',
  TOAST_CLOSE_BTN: '[data-testid="toast-close-btn"]',

  // Loading States
  LOADING_SPINNER: '[data-testid="loading-spinner"]',
  LOADING_SKELETON: '[data-testid="loading-skeleton"]',
  LOADING_OVERLAY: '[data-testid="loading-overlay"]',

  // Empty States
  EMPTY_STATE: '[data-testid="empty-state"]',
  EMPTY_STATE_ICON: '[data-testid="empty-state-icon"]',
  EMPTY_STATE_TITLE: '[data-testid="empty-state-title"]',
  EMPTY_STATE_DESCRIPTION: '[data-testid="empty-state-description"]',
  EMPTY_STATE_ACTION: '[data-testid="empty-state-action"]',

  // Error States
  ERROR_BOUNDARY: '[data-testid="error-boundary"]',
  ERROR_MESSAGE: '[data-testid="error-message"]',
  ERROR_RETRY_BTN: '[data-testid="error-retry-btn"]',

  // Search and Filter
  SEARCH_INPUT: '[data-testid="search-input"]',
  FILTER_BTN: '[data-testid="filter-btn"]',
  FILTER_DROPDOWN: '[data-testid="filter-dropdown"]',
  FILTER_CLEAR_BTN: '[data-testid="filter-clear-btn"]',

  // Pagination
  PAGINATION: '[data-testid="pagination"]',
  PAGINATION_PREV: '[data-testid="pagination-prev"]',
  PAGINATION_NEXT: '[data-testid="pagination-next"]',
  PAGINATION_PAGE: '[data-testid="pagination-page"]',

  // Auth
  LOGIN_PAGE: '[data-testid="login-page"]',
  LOGIN_FORM: '[data-testid="login-form"]',
  LOGIN_USERNAME_INPUT: '[data-testid="login-username-input"]',
  LOGIN_PASSWORD_INPUT: '[data-testid="login-password-input"]',
  LOGIN_SUBMIT_BTN: '[data-testid="login-submit-btn"]',
  LOGIN_ERROR_MESSAGE: '[data-testid="login-error-message"]',
} as const;

// ============================================================================
// ARIA Label Selectors
// ============================================================================

export const AriaLabel = {
  NAVIGATION: '[aria-label="Navigation"]',
  MAIN_CONTENT: '[aria-label="Main content"]',
  SEARCH: '[aria-label="Search"]',
  CLOSE: '[aria-label="Close"]',
  DELETE: '[aria-label="Delete"]',
  EDIT: '[aria-label="Edit"]',
  CREATE: '[aria-label="Create"]',
  SAVE: '[aria-label="Save"]',
  CANCEL: '[aria-label="Cancel"]',
  REFRESH: '[aria-label="Refresh"]',
  SETTINGS: '[aria-label="Settings"]',
  USER_MENU: '[aria-label="User menu"]',
  NOTIFICATIONS: '[aria-label="Notifications"]',
  HELP: '[aria-label="Help"]',
  LOGOUT: '[aria-label="Logout"]',
  MENU: '[aria-label="Menu"]',
  BACK: '[aria-label="Go back"]',
  FORWARD: '[aria-label="Go forward"]',
  COPY: '[aria-label="Copy"]',
  DOWNLOAD: '[aria-label="Download"]',
  UPLOAD: '[aria-label="Upload"]',
  VIEW: '[aria-label="View"]',
  FILTER: '[aria-label="Filter"]',
  SORT: '[aria-label="Sort"]',
  EXPAND: '[aria-label="Expand"]',
  COLLAPSE: '[aria-label="Collapse"]',
  LOADING: '[aria-label="Loading"]',
} as const;

// ============================================================================
// Role Selectors
// ============================================================================

export const Role = {
  BUTTON: (name?: string) => (name ? `role=button[name="${name}"]` : 'role=button'),
  LINK: (name?: string) => (name ? `role=link[name="${name}"]` : 'role=link'),
  HEADING: (level?: number) => (level ? `role=heading[level=${level}]` : 'role=heading'),
  TEXTBOX: (name?: string) => (name ? `role=textbox[name="${name}"]` : 'role=textbox'),
  CHECKBOX: (name?: string) => (name ? `role=checkbox[name="${name}"]` : 'role=checkbox'),
  RADIO: (name?: string) => (name ? `role=radio[name="${name}"]` : 'role=radio'),
  LISTBOX: (name?: string) => (name ? `role=listbox[name="${name}"]` : 'role=listbox'),
  OPTION: (name?: string) => (name ? `role=option[name="${name}"]` : 'role=option'),
  DIALOG: (name?: string) => (name ? `role=dialog[name="${name}"]` : 'role=dialog'),
  ALERT: (name?: string) => (name ? `role=alert[name="${name}"]` : 'role=alert'),
  NAVIGATION: 'role=navigation',
  MAIN: 'role=main',
  SEARCH: 'role=search',
  TABLE: 'role=table',
  ROW: 'role=row',
  CELL: 'role=cell',
  TAB: 'role=tab',
  TABPANEL: 'role=tabpanel',
  PROGRESSBAR: 'role=progressbar',
  STATUS: 'role=status',
  TOOLTIP: 'role=tooltip',
} as const;

// ============================================================================
// Text Selectors
// ============================================================================

export const Text = {
  EXACT: (text: string) => `text="${text}"`,
  CONTAINS: (text: string) => `has-text("${text}")`,
  REGEX: (pattern: string) => `text=/${pattern}/`,
};

// ============================================================================
// Helper Functions for Complex Selectors
// ============================================================================

/**
 * Get container selector by name
 */
export function containerByName(name: string): string {
  return `${DataTestId.CONTAINER_ROW}:has(${DataTestId.CONTAINER_NAME}:text-is("${name}"))`;
}

/**
 * Get container action button by container name and action
 */
export function containerAction(
  name: string,
  action: 'start' | 'stop' | 'restart' | 'delete' | 'logs'
): string {
  const actionMap = {
    start: DataTestId.CONTAINER_START_BTN,
    stop: DataTestId.CONTAINER_STOP_BTN,
    restart: DataTestId.CONTAINER_RESTART_BTN,
    delete: DataTestId.CONTAINER_DELETE_BTN,
    logs: DataTestId.CONTAINER_LOGS_BTN,
  };

  return `${containerByName(name)} ${actionMap[action]}`;
}

/**
 * Get image selector by name and tag
 */
export function imageByNameAndTag(name: string, tag: string): string {
  return `${DataTestId.IMAGE_CARD}:has(${DataTestId.IMAGE_NAME}:text-is("${name}")):has(${DataTestId.IMAGE_TAG}:text-is("${tag}"))`;
}

/**
 * Get toast selector by message content
 */
export function toastByMessage(message: string): string {
  return `${DataTestId.TOAST}:has-text("${message}")`;
}

/**
 * Get form field by label text
 */
export function fieldByLabel(label: string): string {
  return `label:has-text("${label}") + input, label:has-text("${label}") + textarea, label:has-text("${label}") + select`;
}

/**
 * Get table row by cell content
 */
export function tableRowByCell(columnIndex: number, text: string): string {
  return `role=row:has(role=cell:nth-of-type(${columnIndex}):has-text("${text}"))`;
}

/**
 * Get button by text content within a specific context
 */
export function buttonInContext(context: string, buttonText: string): string {
  return `${context}:has-text("${buttonText}") button`;
}

/**
 * Get modal by title
 */
export function modalByTitle(title: string): string {
  return `${DataTestId.MODAL}:has(${DataTestId.MODAL_HEADER}:has-text("${title}"))`;
}

/**
 * Get dropdown item by text
 */
export function dropdownItemByText(text: string): string {
  return `${DataTestId.DROPDOWN_MENU} ${DataTestId.DROPDOWN_ITEM}:has-text("${text}")`;
}

/**
 * Combine multiple selectors
 */
export function combineSelectors(...selectors: string[]): string {
  return selectors.join(' ');
}

/**
 * Get nth element of a selector
 */
export function nth(selector: string, index: number): string {
  return `${selector} >> nth=${index}`;
}

/**
 * Get first element of a selector
 */
export function first(selector: string): string {
  return `${selector} >> nth=0`;
}

/**
 * Get last element of a selector
 */
export function last(selector: string): string {
  return `${selector} >> nth=-1`;
}

// ============================================================================
// CSS Selectors (fallback for complex cases)
// ============================================================================

export const Css = {
  DISABLED: '[disabled]',
  HIDDEN: '[hidden]',
  REQUIRED: '[required]',
  READONLY: '[readonly]',
  FOCUSED: ':focus',
  HOVER: ':hover',
  ACTIVE: ':active',
  CHECKED: ':checked',
  SELECTED: '[aria-selected="true"]',
  EXPANDED: '[aria-expanded="true"]',
  COLLAPSED: '[aria-expanded="false"]',
  BUSY: '[aria-busy="true"]',
  INVALID: ':invalid',
  VALID: ':valid',
} as const;

// ============================================================================
// Export all selectors as default
// ============================================================================

export default {
  DataTestId,
  AriaLabel,
  Role,
  Text,
  Css,
  containerByName,
  containerAction,
  imageByNameAndTag,
  toastByMessage,
  fieldByLabel,
  tableRowByCell,
  buttonInContext,
  modalByTitle,
  dropdownItemByText,
  combineSelectors,
  nth,
  first,
  last,
};
