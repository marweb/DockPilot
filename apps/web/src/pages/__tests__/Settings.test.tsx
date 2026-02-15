import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../Settings';
import * as systemApi from '../../api/system';
import * as toastContext from '../../contexts/ToastContext';

// Mock the API
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the system API
vi.mock('../../api/system', () => ({
  getSystemSettings: vi.fn(),
  updateSystemSettings: vi.fn(),
}));

// Mock the toast context
vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'settings.title': 'Settings',
        'settings.tabs.general': 'General',
        'settings.tabs.notifications': 'Notifications',
        'settings.tabs.versionAndUpdates': 'Version & Updates',
        'settings.tabs.security': 'Security',
        'settings.general.title': 'General Settings',
        'settings.general.instanceInformation': 'Instance Information',
        'settings.general.instanceName': 'Instance Name',
        'settings.general.instanceNamePlaceholder': 'My DockPilot Instance',
        'settings.general.instanceNameRequired': 'Instance name is required',
        'settings.general.publicUrl': 'Public URL',
        'settings.general.publicUrlPlaceholder': 'https://dockpilot.example.com',
        'settings.general.publicUrlInvalid': 'Invalid URL format',
        'settings.general.publicUrlHelp': 'URL used for webhooks and external access',
        'settings.general.instanceDetails': 'Instance Details',
        'settings.general.timezone': 'Instance Timezone',
        'settings.general.timezoneDefault': 'UTC',
        'settings.general.timezoneSearch': 'Search timezone...',
        'settings.general.publicIPv4': "Instance's Public IPv4",
        'settings.general.publicIPv4Placeholder': 'xxx.xxx.xxx.xxx',
        'settings.general.publicIPv4Invalid': 'Invalid IPv4 address',
        'settings.general.publicIPv6': "Instance's Public IPv6",
        'settings.general.publicIPv6Placeholder': 'xxxx:xxxx:xxxx:xxxx',
        'settings.general.publicIPv6Invalid': 'Invalid IPv6 address',
        'settings.general.saveChanges': 'Save Changes',
        'settings.general.saving': 'Saving...',
        'settings.general.unsavedChanges':
          'You have unsaved changes. Are you sure you want to leave?',
        'settings.notifications.title': 'Notification Settings',
        'settings.notifications.comingSoon': 'Notification settings will be available soon.',
        'settings.versionAndUpdates': 'Version & Updates',
        'settings.currentVersion': 'Current Version',
        'settings.checkForUpdates': 'Check for Updates',
        'settings.autoUpdate': 'Automatic Updates',
        'settings.autoUpdateLabel': 'Enable automatic updates',
        'settings.autoUpdateDescription':
          'When enabled, DockPilot will automatically check for and install updates daily at 00:00 UTC.',
        'settings.autoUpdateActive': 'Automatic updates are enabled.',
        'settings.autoUpdateDisabled': 'Automatic updates are disabled.',
        'settings.settingsSaved': 'Settings saved successfully',
        'settings.settingsSaveFailed': 'Failed to save settings',
        'settings.changePassword': 'Change Password',
        'settings.currentPassword': 'Current password',
        'settings.newPassword': 'New password',
        'settings.confirmNewPassword': 'Confirm new password',
        'settings.saveNewPassword': 'Save new password',
        'settings.passwordAllRequired': 'Please complete all password fields',
        'settings.passwordMismatch': 'New passwords do not match',
        'settings.passwordMinLength': 'New password must be at least 8 characters',
        'settings.passwordChanged': 'Password changed successfully',
        'settings.passwordChangeFailed': 'Could not change password',
        'common.optional': 'optional',
      };
      let result = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, v);
        });
      }
      return result;
    },
  }),
}));

describe('Settings Page', () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (toastContext.useToast as ReturnType<typeof vi.fn>).mockReturnValue({
      showToast: mockShowToast,
      hideToast: vi.fn(),
      toasts: [],
    });
  });

  const renderSettings = () => {
    return render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );
  };

  describe('Tabs Navigation', () => {
    it('should render all tabs', () => {
      renderSettings();

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Version & Updates')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should show General tab by default', () => {
      renderSettings();

      expect(screen.getByText('General Settings')).toBeInTheDocument();
    });

    it('should switch to Notifications tab when clicked', () => {
      renderSettings();

      fireEvent.click(screen.getByText('Notifications'));

      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
      expect(screen.getByText('Notification settings will be available soon.')).toBeInTheDocument();
    });

    it('should switch to Security tab when clicked', () => {
      renderSettings();

      fireEvent.click(screen.getByText('Security'));

      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });
  });

  describe('General Settings Tab', () => {
    const mockSettings = {
      instanceName: 'Test Instance',
      publicUrl: 'https://test.example.com',
      timezone: 'UTC',
      publicIPv4: '192.168.1.1',
      publicIPv6: '2001:db8::1',
      autoUpdate: true,
    };

    beforeEach(() => {
      (systemApi.getSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings);
    });

    it('should load and display system settings', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });
    });

    it('should have Instance Name field', () => {
      renderSettings();

      expect(screen.getByLabelText(/Instance Name/i)).toBeInTheDocument();
    });

    it('should have Public URL field', () => {
      renderSettings();

      expect(screen.getByLabelText(/Public URL/i)).toBeInTheDocument();
    });

    it('should have Timezone dropdown', () => {
      renderSettings();

      expect(screen.getByLabelText(/Instance Timezone/i)).toBeInTheDocument();
    });

    it('should have Public IPv4 field with visibility toggle', () => {
      renderSettings();

      expect(screen.getByLabelText(/Instance's Public IPv4/i)).toBeInTheDocument();
    });

    it('should have Public IPv6 field with visibility toggle', () => {
      renderSettings();

      expect(screen.getByLabelText(/Instance's Public IPv6/i)).toBeInTheDocument();
    });

    it('should have Save Changes button', () => {
      renderSettings();

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    it('should disable Save button when no changes made', () => {
      renderSettings();

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button after form changes', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: 'New Instance Name' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      (systemApi.getSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        instanceName: 'Test',
        publicUrl: '',
        timezone: 'UTC',
        publicIPv4: '',
        publicIPv6: '',
        autoUpdate: false,
      });
    });

    it('should validate required Instance Name', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: '' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Instance name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate Public URL format', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const publicUrlInput = screen.getByLabelText(/Public URL/i);
      fireEvent.change(publicUrlInput, { target: { value: 'invalid-url' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument();
      });
    });

    it('should validate IPv4 format', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const ipv4Input = screen.getByLabelText(/Instance's Public IPv4/i);
      fireEvent.change(ipv4Input, { target: { value: 'invalid-ip' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid IPv4 address/i)).toBeInTheDocument();
      });
    });

    it('should validate IPv6 format', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const ipv6Input = screen.getByLabelText(/Instance's Public IPv6/i);
      fireEvent.change(ipv6Input, { target: { value: 'invalid-ipv6' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid IPv6 address/i)).toBeInTheDocument();
      });
    });
  });

  describe('Save Settings', () => {
    beforeEach(() => {
      (systemApi.getSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        instanceName: 'Test',
        publicUrl: '',
        timezone: 'UTC',
        publicIPv4: '',
        publicIPv6: '',
        autoUpdate: false,
      });
    });

    it('should call updateSystemSettings on save', async () => {
      (systemApi.updateSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        instanceName: 'Updated Instance',
        publicUrl: '',
        timezone: 'UTC',
        publicIPv4: '',
        publicIPv6: '',
        autoUpdate: false,
      });

      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: 'Updated Instance' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(systemApi.updateSystemSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            instanceName: 'Updated Instance',
          })
        );
      });
    });

    it('should show success toast on save', async () => {
      (systemApi.updateSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        instanceName: 'Updated Instance',
        publicUrl: '',
        timezone: 'UTC',
        publicIPv4: '',
        publicIPv6: '',
        autoUpdate: false,
      });

      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: 'Updated Instance' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Settings saved successfully', 'success');
      });
    });

    it('should show error toast on save failure', async () => {
      (systemApi.updateSystemSettings as ReturnType<typeof vi.fn>).mockRejectedValue({
        message: 'Server error',
      });

      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: 'Updated Instance' } });

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Server error', 'error');
      });
    });
  });

  describe('Password Change', () => {
    it('should validate all fields are required', async () => {
      renderSettings();

      fireEvent.click(screen.getByText('Security'));

      const saveButton = screen.getByRole('button', { name: /Save new password/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Please complete all password fields/i)).toBeInTheDocument();
      });
    });

    it('should validate password match', async () => {
      renderSettings();

      fireEvent.click(screen.getByText('Security'));

      fireEvent.change(screen.getByLabelText(/Current password/i), {
        target: { value: 'oldpass' },
      });
      fireEvent.change(screen.getByLabelText(/New password/i), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
        target: { value: 'different' },
      });

      const saveButton = screen.getByRole('button', { name: /Save new password/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/New passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should validate minimum password length', async () => {
      renderSettings();

      fireEvent.click(screen.getByText('Security'));

      fireEvent.change(screen.getByLabelText(/Current password/i), {
        target: { value: 'oldpass' },
      });
      fireEvent.change(screen.getByLabelText(/New password/i), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
        target: { value: 'short' },
      });

      const saveButton = screen.getByRole('button', { name: /Save new password/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/New password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Unsaved Changes Warning', () => {
    beforeEach(() => {
      (systemApi.getSystemSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        instanceName: 'Test',
        publicUrl: '',
        timezone: 'UTC',
        publicIPv4: '',
        publicIPv6: '',
        autoUpdate: false,
      });

      vi.stubGlobal(
        'confirm',
        vi.fn(() => true)
      );
    });

    it('should warn when leaving with unsaved changes', async () => {
      renderSettings();

      await waitFor(() => {
        expect(systemApi.getSystemSettings).toHaveBeenCalled();
      });

      const instanceNameInput = screen.getByLabelText(/Instance Name/i);
      fireEvent.change(instanceNameInput, { target: { value: 'Changed' } });

      fireEvent.click(screen.getByText('Notifications'));

      expect(window.confirm).toHaveBeenCalled();
    });
  });
});
