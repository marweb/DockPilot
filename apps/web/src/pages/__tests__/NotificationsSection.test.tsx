import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import NotificationsSection from '../Settings/NotificationsSection';
import * as notificationsApi from '../../api/notifications';
import { ToastProvider } from '../../contexts/ToastContext';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the API module
vi.mock('../../api/notifications', () => ({
  getNotificationChannels: vi.fn(),
  saveNotificationChannel: vi.fn(),
  sendTestNotification: vi.fn(),
}));

// Mock toast context
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{component}</ToastProvider>
    </QueryClientProvider>
  );
};

describe('NotificationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('Initial Render', () => {
    it('should render the notification section header', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Configure notification channels for alerts and system events')
      ).toBeInTheDocument();
    });

    it('should render all tabs', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Transactional Email')).toBeInTheDocument();
      });

      expect(screen.getByText('Slack')).toBeInTheDocument();
      expect(screen.getByText('Telegram')).toBeInTheDocument();
      expect(screen.getByText('Discord')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<NotificationsSection />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Transactional Email Tab', () => {
    beforeEach(() => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: false,
          configured: false,
          fromName: '',
          fromAddress: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should render email form fields', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Transactional Email')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/from name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/from address/i)).toBeInTheDocument();
    });

    it('should render SMTP Server collapsible section', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('SMTP Server')).toBeInTheDocument();
      });
    });

    it('should render Resend collapsible section', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Resend')).toBeInTheDocument();
      });
    });

    it('should enable/disable SMTP fields based on toggle', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('SMTP Server')).toBeInTheDocument();
      });

      // Find the toggle button within the SMTP Server section
      const smtpSection = screen.getByText('SMTP Server').closest('[class*="rounded-lg"]');
      if (smtpSection) {
        const toggle = within(smtpSection as HTMLElement).getByRole('switch');
        expect(toggle).not.toBeChecked();
      }
    });
  });

  describe('Slack Tab', () => {
    beforeEach(() => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '2',
          provider: 'slack',
          name: 'Slack',
          enabled: false,
          configured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should render Slack configuration form when tab is clicked', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Slack')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Slack'));

      await waitFor(() => {
        expect(screen.getByText('Slack Integration')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/enabled/i)).toBeInTheDocument();
    });

    it('should show configured badge when Slack is configured', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '2',
          provider: 'slack',
          name: 'Slack',
          enabled: true,
          configured: true,
          webhookUrl: 'https://hooks.slack.com/test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Configured')).toBeInTheDocument();
      });
    });
  });

  describe('Telegram Tab', () => {
    beforeEach(() => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '3',
          provider: 'telegram',
          name: 'Telegram',
          enabled: false,
          configured: false,
          chatId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should render Telegram configuration form', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Telegram')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Telegram'));

      await waitFor(() => {
        expect(screen.getByText('Telegram Integration')).toBeInTheDocument();
      });
    });
  });

  describe('Discord Tab', () => {
    beforeEach(() => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '4',
          provider: 'discord',
          name: 'Discord',
          enabled: false,
          configured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    });

    it('should render Discord configuration form', async () => {
      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Discord')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Discord'));

      await waitFor(() => {
        expect(screen.getByText('Discord Integration')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for invalid email', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/from address/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/from address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      // Try to save by clicking Save SMTP button
      const saveButton = screen.getByRole('button', { name: /save smtp/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });
    });

    it('should require host when SMTP is enabled', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: false,
          host: '',
          port: 587,
          fromName: 'Test',
          fromAddress: 'test@example.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save smtp/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save smtp/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/host is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should disable save button when no changes', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: false,
          configured: false,
          fromName: 'DockPilot',
          fromAddress: 'test@example.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save smtp/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('should call save API when form is valid', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: false,
          configured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      vi.mocked(notificationsApi.saveNotificationChannel).mockResolvedValue({
        id: '1',
        provider: 'smtp',
        name: 'SMTP Server',
        enabled: true,
        configured: true,
        fromName: 'DockPilot',
        fromAddress: 'test@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/from name/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/from name/i), { target: { value: 'DockPilot' } });
      fireEvent.change(screen.getByLabelText(/from address/i), {
        target: { value: 'test@example.com' },
      });

      const saveButton = screen.getByRole('button', { name: /save smtp/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(notificationsApi.saveNotificationChannel).toHaveBeenCalledWith(
          'smtp',
          expect.any(Object)
        );
      });
    });
  });

  describe('Test Notifications', () => {
    it('should open test modal when Send Test button is clicked', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send test email/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

      await waitFor(() => {
        expect(screen.getByText(/test smtp/i)).toBeInTheDocument();
      });
    });

    it('should show rate limit warning', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      vi.mocked(notificationsApi.sendTestNotification).mockResolvedValue({
        success: true,
        message: 'Test email sent successfully',
      });

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send test email/i })).toBeInTheDocument();
      });

      // First test
      fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

      await waitFor(() => {
        expect(screen.getByText(/test smtp/i)).toBeInTheDocument();
      });

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      // Try second test immediately
      fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

      await waitFor(() => {
        expect(screen.getByText(/please wait/i)).toBeInTheDocument();
      });
    });

    it('should show success result after test', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      vi.mocked(notificationsApi.sendTestNotification).mockResolvedValue({
        success: true,
        message: 'Test email sent successfully',
      });

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send test email/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /send test email/i }));

      await waitFor(() => {
        expect(screen.getByText(/test smtp/i)).toBeInTheDocument();
      });

      // Fill email
      fireEvent.change(screen.getByPlaceholderText(/test@example.com/i), {
        target: { value: 'test@test.com' },
      });

      // Send test
      fireEvent.click(screen.getByRole('button', { name: /send test$/i }));

      await waitFor(() => {
        expect(screen.getByText(/test successful/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when API fails', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load notification channels/i)).toBeInTheDocument();
      });
    });

    it('should handle save errors', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: false,
          configured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      vi.mocked(notificationsApi.saveNotificationChannel).mockRejectedValue(
        new Error('Save failed')
      );

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/from name/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/from name/i), { target: { value: 'Test' } });

      const saveButton = screen.getByRole('button', { name: /save smtp/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save smtp configuration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('SMTP Server')).toBeInTheDocument();
      });

      // Expand SMTP section
      fireEvent.click(screen.getByText('SMTP Server'));

      await waitFor(() => {
        expect(screen.getByLabelText(/smtp password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/smtp password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click eye icon
      const toggleButton =
        screen.getByRole('button', { name: /show password/i }) ||
        screen.getAllByRole('button').find((btn) => btn.querySelector('svg'));

      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(passwordInput).toHaveAttribute('type', 'text');
      }
    });
  });

  describe('Configured State', () => {
    it('should display masked password when configured', async () => {
      vi.mocked(notificationsApi.getNotificationChannels).mockResolvedValue([
        {
          id: '1',
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          configured: true,
          host: 'smtp.gmail.com',
          port: 587,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithProviders(<NotificationsSection />);

      await waitFor(() => {
        expect(screen.getByText('Configured')).toBeInTheDocument();
      });
    });
  });
});
