import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventsMatrix from '../Settings/EventsMatrix';
import * as api from '../../api/client';

const mockShowToast = vi.fn();

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const matrixPayload = {
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
};

describe('EventsMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockReset();
  });

  it('should render loading state', () => {
    vi.mocked(api.default.get).mockImplementation(() => new Promise(() => {}));

    render(<EventsMatrix />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render event categories', async () => {
    vi.mocked(api.default.get).mockResolvedValue({ data: matrixPayload });

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });
  });

  it('should toggle notification rule', async () => {
    const mockPost = vi.fn().mockResolvedValue({ data: {} });

    vi.mocked(api.default.get).mockResolvedValue({ data: matrixPayload });
    vi.mocked(api.default.post).mockImplementation(mockPost);

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Containers'));

    await waitFor(() => {
      const toggleButton = screen.getByTitle('Disabled');
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
    vi.mocked(api.default.get).mockRejectedValue(new Error('API Error'));

    render(<EventsMatrix />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to load notification settings', 'error');
    });
  });

  it('should update existing rule', async () => {
    const mockPut = vi.fn().mockResolvedValue({ data: {} });

    vi.mocked(api.default.get).mockResolvedValue({
      data: {
        ...matrixPayload,
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

    fireEvent.click(screen.getByText('Containers'));

    await waitFor(() => {
      const toggleButton = screen.getByTitle('Enabled');
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
