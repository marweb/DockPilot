import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventsMatrix from '../Settings/EventsMatrix';
import * as api from '../../api/client';

// Mock the toast context
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

// Mock API client
vi.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('EventsMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    vi.mocked(api.default.get).mockImplementation(() => new Promise(() => {}));

    render(<EventsMatrix />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render event categories', async () => {
    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        channels: [
          {
            id: '1',
            provider: 'smtp',
            name: 'Email',
            enabled: true,
            configured: true,
          },
        ],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
        },
        matrix: {},
      },
    });

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });
  });

  it('should toggle notification rule', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        channels: [
          {
            id: 'channel-1',
            provider: 'smtp',
            name: 'Email',
            enabled: true,
            configured: true,
          },
        ],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
        },
        matrix: {
          'container.crashed': [],
        },
      },
    });

    const mockPost = vi.fn().mockResolvedValue({ data: {} });
    const mockPut = vi.fn().mockResolvedValue({ data: {} });

    vi.mocked(api.default.get).mockImplementation(mockGet);
    vi.mocked(api.default.post).mockImplementation(mockPost);
    vi.mocked(api.default.put).mockImplementation(mockPut);

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });

    // Expand category
    const categoryButton = screen.getByText('Containers');
    fireEvent.click(categoryButton);

    await waitFor(() => {
      const toggleButton = screen.getByRole('button', { name: /Enable/i });
      expect(toggleButton).toBeInTheDocument();
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/notifications/rules',
        expect.objectContaining({
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: true,
        })
      );
    });
  });

  it('should show error on API failure', async () => {
    const mockShowToast = vi.fn();

    vi.mock('../../contexts/ToastContext', () => ({
      useToast: () => ({
        showToast: mockShowToast,
      }),
    }));

    vi.mocked(api.default.get).mockRejectedValue(new Error('API Error'));

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'settings.notifications.errors.loadFailed',
        'error'
      );
    });
  });

  it('should render channel icons correctly', async () => {
    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        channels: [
          { id: '1', provider: 'smtp', name: 'Email', enabled: true, configured: true },
          { id: '2', provider: 'slack', name: 'Slack', enabled: true, configured: true },
          { id: '3', provider: 'telegram', name: 'Telegram', enabled: true, configured: true },
          { id: '4', provider: 'discord', name: 'Discord', enabled: true, configured: true },
        ],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
        },
        matrix: {},
      },
    });

    render(<EventsMatrix />);

    await waitFor(() => {
      // Verificar que se renderizan los iconos de canales
      expect(screen.getByText('smtp')).toBeInTheDocument();
      expect(screen.getByText('slack')).toBeInTheDocument();
      expect(screen.getByText('telegram')).toBeInTheDocument();
      expect(screen.getByText('discord')).toBeInTheDocument();
    });
  });

  it('should display correct severity badges', async () => {
    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        channels: [],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
          'auth.login.failed': {
            category: 'auth',
            severity: 'warning',
            description: 'Login failed',
          },
          'system.startup': {
            category: 'system',
            severity: 'info',
            description: 'System started',
          },
        },
        matrix: {},
      },
    });

    render(<EventsMatrix />);

    await waitFor(() => {
      // Verificar severidades
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
      expect(screen.getByText('info')).toBeInTheDocument();
    });
  });

  it('should expand and collapse categories', async () => {
    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        channels: [],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
        },
        matrix: {},
      },
    });

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });

    const categoryButton = screen.getByText('Containers');

    // Click to expand
    fireEvent.click(categoryButton);

    await waitFor(() => {
      // After expanding, table should be visible
      expect(screen.getByText('Event')).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(categoryButton);

    await waitFor(() => {
      // After collapsing, ChevronRight should be shown
      expect(document.querySelector('[data-testid="chevron-right"]')).toBeNull();
    });
  });

  it('should update existing rule', async () => {
    const mockPut = vi.fn().mockResolvedValue({ data: {} });

    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        channels: [
          { id: 'channel-1', provider: 'smtp', name: 'Email', enabled: true, configured: true },
        ],
        events: {
          'container.crashed': {
            category: 'container',
            severity: 'critical',
            description: 'Container crashed',
          },
        },
        matrix: {
          'container.crashed': [
            {
              id: 'rule-1',
              eventType: 'container.crashed',
              channelId: 'channel-1',
              enabled: true,
              minSeverity: 'info',
            },
          ],
        },
      },
    });

    vi.mocked(api.default.put).mockImplementation(mockPut);

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });

    // Expand category
    fireEvent.click(screen.getByText('Containers'));

    await waitFor(() => {
      // Find toggle button for existing enabled rule
      const toggleButton = screen.getByRole('button', { name: /Disable/i });
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/notifications/rules/rule-1',
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });
});
