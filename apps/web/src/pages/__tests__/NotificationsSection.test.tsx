import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationsSection from '../Settings/NotificationsSection';
import * as notificationsApi from '../../api/notifications';

vi.mock('../../api/notifications', () => ({
  getNotificationChannels: vi.fn(),
  saveNotificationChannel: vi.fn(),
  sendTestNotification: vi.fn(),
  saveGeneralNotificationSettings: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderSection = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsSection />
    </QueryClientProvider>
  );

describe('NotificationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([]);
    vi.mocked(notificationsApi.saveGeneralNotificationSettings).mockResolvedValue({
      fromName: 'DockPilot',
      fromAddress: 'noreply@example.com',
      updatedProviders: 0,
    });
  });

  it('renders header and channel tabs', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Configure notification channels for alerts and system events')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Transactional Email').length).toBeGreaterThan(0);
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('Telegram')).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
  });

  it('shows loading spinner while channels load', () => {
    vi.mocked(notificationsApi.getNotificationChannels).mockImplementation(
      () => new Promise(() => {})
    );

    renderSection();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders SMTP section on email tab', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('SMTP Server')).toBeInTheDocument();
    });
  });

  it('opens Slack configuration tab', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText('Slack')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Slack'));

    await waitFor(() => {
      expect(screen.getByText('Slack Integration')).toBeInTheDocument();
    });
  });
});
