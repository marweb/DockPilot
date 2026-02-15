import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decrypt } from '../utils/crypto.js';
import type {
  NotificationChannel,
  NotificationProvider as DBNotificationProvider,
} from './database.js';
import { z } from 'zod';

export type NotificationProvider = 'smtp' | 'resend' | 'slack' | 'telegram' | 'discord';

export interface NotificationResult {
  success: boolean;
  message: string;
  error?: string;
  timestamp: string;
}

export interface NotificationAdapter {
  name: string;
  send(message: string, options?: Record<string, unknown>): Promise<NotificationResult>;
  validate(config: unknown): boolean;
  test(config: unknown, recipient?: string): Promise<NotificationResult>;
}

export interface TestResult {
  success: boolean;
  message: string;
  error?: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'ssl' | 'tls' | 'starttls';
  fromName: string;
  fromAddress: string;
}

interface ResendConfig {
  apiKey: string;
  fromAddress: string;
}

interface SlackConfig {
  webhookUrl: string;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface DiscordConfig {
  webhookUrl: string;
}

interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
}

const defaultLogger: Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${msg}`, meta ? JSON.stringify(sanitizeLog(meta)) : '');
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(sanitizeLog(meta)) : '');
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(sanitizeLog(meta)) : '');
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${msg}`, meta ? JSON.stringify(sanitizeLog(meta)) : '');
    }
  },
};

function sanitizeLog(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...meta };
  const sensitiveKeys = [
    'password',
    'apiKey',
    'token',
    'secret',
    'auth',
    'authorization',
    'bearer',
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLog(sanitized[key] as Record<string, unknown>);
    }
  }

  return sanitized;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  logger: Logger,
  context: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxRetries} for ${context}`);
      const result = await operation();
      if (attempt > 1) {
        logger.info(`Retry successful for ${context} on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} attempts failed for ${context}`, {
          error: lastError.message,
          attempts: attempt,
        });
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed for ${context}, retrying in ${delay}ms`, {
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

const SMTPAdapterConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  secure: z.boolean().optional(),
  requireTLS: z.boolean().optional(),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }),
  from: z.object({
    name: z.string().optional(),
    address: z.string().email(),
  }),
  timeout: z.number().int().positive().optional().default(30000),
  tls: z
    .object({
      rejectUnauthorized: z.boolean().optional(),
    })
    .optional(),
});

type SMTPAdapterConfig = z.infer<typeof SMTPAdapterConfigSchema>;

export class SMTPAdapter implements NotificationAdapter {
  name = 'smtp';
  private logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  validate(config: unknown): boolean {
    try {
      SMTPAdapterConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  private createTransporter(config: SMTPAdapterConfig): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      requireTLS: config.requireTLS ?? false,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      connectionTimeout: config.timeout,
      greetingTimeout: config.timeout,
      socketTimeout: config.timeout,
      tls: config.tls,
    });
  }

  async send(message: string, options?: Record<string, unknown>): Promise<NotificationResult> {
    const config = options?.config as SMTPAdapterConfig;
    const to = options?.to as string;
    const subject = (options?.subject as string) || 'Notification';

    if (!config || !this.validate(config)) {
      return {
        success: false,
        message: 'Invalid SMTP configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    if (!to) {
      return {
        success: false,
        message: 'Recipient address is required',
        error: 'Missing "to" parameter',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Sending email via SMTP', { to, subject, host: config.host });

    try {
      const result = await withRetry(
        async () => {
          const transporter = this.createTransporter(config);
          const from = config.from.name
            ? `"${config.from.name}" <${config.from.address}>`
            : config.from.address;

          const info = await transporter.sendMail({
            from,
            to,
            subject,
            text: message,
            html: (options?.html as string) || undefined,
          });

          return info;
        },
        this.logger,
        'SMTP send',
        3,
        1000
      );

      this.logger.info('Email sent successfully', { messageId: result.messageId });

      return {
        success: true,
        message: 'Email sent successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send email', { error: errorMsg });

      return {
        success: false,
        message: 'Failed to send email',
        error: this.sanitizeError(errorMsg),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(config: unknown, recipient?: string): Promise<NotificationResult> {
    if (!this.validate(config)) {
      return {
        success: false,
        message: 'Invalid SMTP configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    const smtpConfig = config as SMTPAdapterConfig;
    const testRecipient = recipient || smtpConfig.auth.user;

    this.logger.info('Testing SMTP configuration', { host: smtpConfig.host });

    try {
      await withRetry(
        async () => {
          const transporter = this.createTransporter(smtpConfig);
          await transporter.verify();
          return transporter;
        },
        this.logger,
        'SMTP verification',
        3,
        1000
      );

      const testMessage = `This is a test email from DockPilot notification service.

Timestamp: ${new Date().toISOString()}
Configuration tested successfully.

If you received this, your SMTP configuration is working correctly.`;

      await this.send(testMessage, {
        config: smtpConfig,
        to: testRecipient,
        subject: 'DockPilot SMTP Test',
      });

      this.logger.info('SMTP test completed successfully');

      return {
        success: true,
        message: `SMTP configuration is valid. Test email sent to ${testRecipient}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('SMTP test failed', { error: errorMsg });

      return {
        success: false,
        message: 'SMTP test failed',
        error: this.sanitizeError(errorMsg),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private sanitizeError(error: string): string {
    return error
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b(password|pass|pwd|secret|key|token)\s*[:=]\s*\S+/gi, '$1=***');
  }
}

const ResendAdapterConfigSchema = z.object({
  apiKey: z.string().min(1),
  from: z.string().email(),
});

type ResendAdapterConfig = z.infer<typeof ResendAdapterConfigSchema>;

export class ResendAdapter implements NotificationAdapter {
  name = 'resend';
  private logger: Logger;
  private baseUrl = 'https://api.resend.com/emails';

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  validate(config: unknown): boolean {
    try {
      ResendAdapterConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  async send(message: string, options?: Record<string, unknown>): Promise<NotificationResult> {
    const config = options?.config as ResendAdapterConfig;
    const to = options?.to as string;
    const subject = (options?.subject as string) || 'Notification';

    if (!config || !this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Resend configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    if (!to) {
      return {
        success: false,
        message: 'Recipient address is required',
        error: 'Missing "to" parameter',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Sending email via Resend', { to, subject });

    try {
      const result = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(this.baseUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: config.from,
                to,
                subject,
                text: message,
                html: (options?.html as string) || undefined,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorData = (await response
                .json()
                .catch(() => ({ message: 'Unknown error' }))) as { message: string };
              throw new Error(
                `Resend API error: ${response.status} - ${errorData.message || response.statusText}`
              );
            }

            return (await response.json()) as { id: string };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        this.logger,
        'Resend send',
        3,
        1000
      );

      this.logger.info('Email sent successfully via Resend', { id: result.id });

      return {
        success: true,
        message: 'Email sent successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send email via Resend', { error: errorMsg });

      return {
        success: false,
        message: 'Failed to send email',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(config: unknown, recipient?: string): Promise<NotificationResult> {
    if (!this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Resend configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    const resendConfig = config as ResendAdapterConfig;
    const testRecipient = recipient || resendConfig.from;

    this.logger.info('Testing Resend configuration');

    const testMessage = `This is a test email from DockPilot notification service.

Timestamp: ${new Date().toISOString()}
Configuration tested successfully.

If you received this, your Resend configuration is working correctly.`;

    return await this.send(testMessage, {
      config: resendConfig,
      to: testRecipient,
      subject: 'DockPilot Resend Test',
    });
  }
}

const SlackAdapterConfigSchema = z.object({
  webhookUrl: z.string().url(),
});

type SlackAdapterConfig = z.infer<typeof SlackAdapterConfigSchema>;

export class SlackAdapter implements NotificationAdapter {
  name = 'slack';
  private logger: Logger;
  private rateLimitDelay = 1000;

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  validate(config: unknown): boolean {
    try {
      SlackAdapterConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  async send(message: string, options?: Record<string, unknown>): Promise<NotificationResult> {
    const config = options?.config as SlackAdapterConfig;

    if (!config || !this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Slack configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Sending message to Slack');

    try {
      await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(config.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: message,
                username: (options?.username as string) || 'DockPilot',
                icon_emoji: (options?.iconEmoji as string) || ':rocket:',
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimitDelay;
              this.logger.warn(`Slack rate limit hit, retrying after ${delay}ms`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              throw new Error('Rate limited');
            }

            if (!response.ok) {
              throw new Error(`Slack API error: ${response.status} - ${response.statusText}`);
            }

            const text = await response.text();
            return { ok: text === 'ok' };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        this.logger,
        'Slack send',
        3,
        1000
      );

      this.logger.info('Message sent successfully to Slack');

      return {
        success: true,
        message: 'Message sent to Slack',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send message to Slack', { error: errorMsg });

      return {
        success: false,
        message: 'Failed to send message to Slack',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(config: unknown, _recipient?: string): Promise<NotificationResult> {
    if (!this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Slack configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Testing Slack configuration');

    const testMessage = `🧪 *DockPilot Test*

This is a test message from DockPilot notification service.

Timestamp: ${new Date().toISOString()}
Configuration tested successfully.

If you see this, your Slack webhook is working correctly!`;

    return await this.send(testMessage, {
      config: config as SlackAdapterConfig,
      username: 'DockPilot Test',
    });
  }
}

const TelegramAdapterConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

type TelegramAdapterConfig = z.infer<typeof TelegramAdapterConfigSchema>;

export class TelegramAdapter implements NotificationAdapter {
  name = 'telegram';
  private logger: Logger;
  private baseUrl = 'https://api.telegram.org/bot';

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  validate(config: unknown): boolean {
    try {
      TelegramAdapterConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async send(message: string, options?: Record<string, unknown>): Promise<NotificationResult> {
    const config = options?.config as TelegramAdapterConfig;

    if (!config || !this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Telegram configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Sending message to Telegram');

    try {
      const result = await withRetry(
        async () => {
          const url = `${this.baseUrl}${config.botToken}/sendMessage`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const parseMode = (options?.parseMode as string) || 'HTML';
            let formattedMessage = message;

            if (parseMode === 'HTML') {
              formattedMessage = this.escapeHtml(message)
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
                .replace(/_(.+?)_/g, '<i>$1</i>')
                .replace(/`(.+?)`/g, '<code>$1</code>');
            }

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: config.chatId,
                text: formattedMessage,
                parse_mode: parseMode,
                disable_notification: (options?.silent as boolean) || false,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorData = (await response
                .json()
                .catch(() => ({ description: 'Unknown error' }))) as { description: string };
              throw new Error(
                `Telegram API error: ${response.status} - ${errorData.description || response.statusText}`
              );
            }

            return (await response.json()) as { result?: { message_id: number } };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        this.logger,
        'Telegram send',
        3,
        1000
      );

      this.logger.info('Message sent successfully to Telegram', {
        messageId: result.result?.message_id,
      });

      return {
        success: true,
        message: 'Message sent to Telegram',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send message to Telegram', { error: errorMsg });

      return {
        success: false,
        message: 'Failed to send message to Telegram',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(config: unknown, _recipient?: string): Promise<NotificationResult> {
    if (!this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Telegram configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Testing Telegram configuration');

    const testMessage = `🧪 <b>DockPilot Test</b>

This is a test message from DockPilot notification service.

<b>Timestamp:</b> ${new Date().toISOString()}
<b>Status:</b> Configuration tested successfully

If you see this, your Telegram bot is working correctly!`;

    return await this.send(testMessage, {
      config: config as TelegramAdapterConfig,
    });
  }
}

const DiscordAdapterConfigSchema = z.object({
  webhookUrl: z.string().url(),
});

type DiscordAdapterConfig = z.infer<typeof DiscordAdapterConfigSchema>;

export class DiscordAdapter implements NotificationAdapter {
  name = 'discord';
  private logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.logger = logger;
  }

  validate(config: unknown): boolean {
    try {
      DiscordAdapterConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  async send(message: string, options?: Record<string, unknown>): Promise<NotificationResult> {
    const config = options?.config as DiscordAdapterConfig;

    if (!config || !this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Discord configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Sending message to Discord');

    try {
      await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const embed = options?.embed as Record<string, unknown>;
            const payload: Record<string, unknown> = embed
              ? { embeds: [embed] }
              : { content: message };

            if (options?.username) {
              payload.username = options.username;
            }

            const response = await fetch(config.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After');
              const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
              this.logger.warn(`Discord rate limit hit, retrying after ${delay}ms`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              throw new Error('Rate limited');
            }

            if (!response.ok) {
              throw new Error(`Discord API error: ${response.status} - ${response.statusText}`);
            }

            return { ok: true };
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        this.logger,
        'Discord send',
        3,
        1000
      );

      this.logger.info('Message sent successfully to Discord');

      return {
        success: true,
        message: 'Message sent to Discord',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send message to Discord', { error: errorMsg });

      return {
        success: false,
        message: 'Failed to send message to Discord',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(config: unknown, _recipient?: string): Promise<NotificationResult> {
    if (!this.validate(config)) {
      return {
        success: false,
        message: 'Invalid Discord configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info('Testing Discord configuration');

    const testEmbed = {
      title: '🧪 DockPilot Test',
      description: 'This is a test message from DockPilot notification service.',
      color: 0x00ff00,
      fields: [
        {
          name: 'Timestamp',
          value: new Date().toISOString(),
          inline: true,
        },
        {
          name: 'Status',
          value: 'Configuration tested successfully',
          inline: true,
        },
      ],
      footer: {
        text: 'If you see this, your Discord webhook is working correctly!',
      },
    };

    return await this.send('', {
      config: config as DiscordAdapterConfig,
      embed: testEmbed,
      username: 'DockPilot Test',
    });
  }
}

export class NotificationServiceManager {
  private adapters: Map<NotificationProvider, NotificationAdapter>;
  private logger: Logger;

  constructor(logger: Logger = defaultLogger) {
    this.adapters = new Map();
    this.logger = logger;
  }

  registerAdapter(provider: NotificationProvider, adapter: NotificationAdapter): void {
    this.adapters.set(provider, adapter);
    this.logger.info(`Registered adapter for provider: ${provider}`, { adapterName: adapter.name });
  }

  getAdapter(provider: NotificationProvider): NotificationAdapter | undefined {
    return this.adapters.get(provider);
  }

  async send(
    provider: NotificationProvider,
    message: string,
    options?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      this.logger.error(`No adapter registered for provider: ${provider}`);
      return {
        success: false,
        message: `No adapter registered for provider: ${provider}`,
        error: 'Adapter not found',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info(`Sending notification via ${provider}`, { messageLength: message.length });

    try {
      const result = await adapter.send(message, options);

      if (result.success) {
        this.logger.info(`Notification sent successfully via ${provider}`);
      } else {
        this.logger.warn(`Notification failed via ${provider}`, { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Unexpected error sending notification via ${provider}`, {
        error: errorMsg,
      });

      return {
        success: false,
        message: `Unexpected error sending notification via ${provider}`,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async test(
    provider: NotificationProvider,
    config: unknown,
    recipient?: string
  ): Promise<NotificationResult> {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      this.logger.error(`No adapter registered for provider: ${provider}`);
      return {
        success: false,
        message: `No adapter registered for provider: ${provider}`,
        error: 'Adapter not found',
        timestamp: new Date().toISOString(),
      };
    }

    if (!adapter.validate(config)) {
      this.logger.warn(`Invalid configuration for provider: ${provider}`);
      return {
        success: false,
        message: 'Invalid configuration',
        error: 'Configuration validation failed',
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info(`Testing configuration for provider: ${provider}`);

    try {
      const result = await adapter.test(config, recipient);

      if (result.success) {
        this.logger.info(`Test successful for provider: ${provider}`);
      } else {
        this.logger.warn(`Test failed for provider: ${provider}`, { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Unexpected error testing configuration for ${provider}`, {
        error: errorMsg,
      });

      return {
        success: false,
        message: `Unexpected error testing configuration for ${provider}`,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  validate(provider: NotificationProvider, config: unknown): boolean {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      this.logger.warn(`Cannot validate: no adapter registered for provider: ${provider}`);
      return false;
    }

    const isValid = adapter.validate(config);
    this.logger.debug(`Validation for ${provider}: ${isValid ? 'valid' : 'invalid'}`);

    return isValid;
  }
}

export function createNotificationService(logger?: Logger): NotificationServiceManager {
  const service = new NotificationServiceManager(logger);

  service.registerAdapter('smtp', new SMTPAdapter(logger));
  service.registerAdapter('resend', new ResendAdapter(logger));
  service.registerAdapter('slack', new SlackAdapter(logger));
  service.registerAdapter('telegram', new TelegramAdapter(logger));
  service.registerAdapter('discord', new DiscordAdapter(logger));

  return service;
}

let defaultNotificationService: NotificationServiceManager | undefined;

export function getDefaultNotificationService(logger?: Logger): NotificationServiceManager {
  if (!defaultNotificationService) {
    defaultNotificationService = createNotificationService(logger);
  }
  return defaultNotificationService;
}

export class NotificationService {
  private masterKey: string;

  constructor(masterKey: string) {
    this.masterKey = masterKey;
  }

  /**
   * Decrypt sensitive fields in the channel config
   */
  private decryptConfig(
    channel: NotificationChannel
  ): SMTPConfig | ResendConfig | SlackConfig | TelegramConfig | DiscordConfig {
    const config = JSON.parse(channel.config);

    const sensitiveFields: Record<DBNotificationProvider, string[]> = {
      smtp: ['password'],
      resend: ['apiKey'],
      slack: ['webhookUrl'],
      telegram: ['botToken'],
      discord: ['webhookUrl'],
    };

    const fields = sensitiveFields[channel.provider];
    for (const field of fields) {
      if (config[field] && typeof config[field] === 'string') {
        try {
          config[field] = decrypt(config[field], this.masterKey);
        } catch (error) {
          // If decryption fails, the value might not be encrypted
          console.warn(`Failed to decrypt field ${field} for ${channel.provider}:`, error);
        }
      }
    }

    return config;
  }

  /**
   * Send a test notification
   */
  async test(
    channel: NotificationChannel,
    testEmail?: string,
    testMessage?: string,
    instanceName?: string
  ): Promise<TestResult> {
    if (!channel.enabled) {
      return {
        success: false,
        message: 'Channel is disabled',
        error: 'The notification channel is currently disabled',
      };
    }

    try {
      const config = this.decryptConfig(channel);

      switch (channel.provider) {
        case 'smtp':
          return await this.testSMTP(config as SMTPConfig, testEmail, testMessage, instanceName);
        case 'resend':
          return await this.testResend(
            config as ResendConfig,
            testEmail,
            testMessage,
            instanceName
          );
        case 'slack':
          return await this.testSlack(config as SlackConfig, testMessage, instanceName);
        case 'telegram':
          return await this.testTelegram(config as TelegramConfig, testMessage, instanceName);
        case 'discord':
          return await this.testDiscord(config as DiscordConfig, testMessage, instanceName);
        default:
          return {
            success: false,
            message: 'Unknown provider',
            error: `Provider ${channel.provider} is not supported`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Failed to send test notification',
        error: errorMessage,
      };
    }
  }

  /**
   * Build test message based on provider
   */
  private buildTestMessage(
    provider: DBNotificationProvider,
    customMessage: string | undefined,
    instanceName: string
  ): { subject: string; body: string } {
    const timestamp = new Date().toISOString();

    if (provider === 'smtp' || provider === 'resend') {
      const subject =
        customMessage ||
        '🧪 DockPilot Test - This is a test notification from your DockPilot instance';
      const body = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DockPilot Test Notification</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0;">🧪 Test Notification</h1>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; color: #333;">This is a test notification from your DockPilot instance.</p>
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 5px 0; color: #666;"><strong>Instance:</strong> ${instanceName}</p>
      <p style="margin: 5px 0; color: #666;"><strong>Time:</strong> ${timestamp}</p>
    </div>
    <p style="color: #888; font-size: 14px;">If you received this, your notification configuration is working correctly!</p>
  </div>
</body>
</html>`;
      return { subject, body };
    } else {
      // Slack, Telegram, Discord
      const message =
        customMessage ||
        `🧪 DockPilot Test\n\nThis is a test notification from your DockPilot instance.\n\nInstance: ${instanceName}\nTime: ${timestamp}`;
      return { subject: '', body: message };
    }
  }

  /**
   * Test SMTP configuration
   */
  private async testSMTP(
    config: SMTPConfig,
    testEmail?: string,
    customMessage?: string,
    instanceName = 'DockPilot'
  ): Promise<TestResult> {
    if (!testEmail) {
      return {
        success: false,
        message: 'Test email required',
        error: 'testEmail is required for SMTP notifications',
      };
    }

    const { subject, body } = this.buildTestMessage('smtp', customMessage, instanceName);

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.encryption === 'ssl' || config.port === 465,
        requireTLS: config.encryption === 'tls' || config.encryption === 'starttls',
        auth: {
          user: config.username,
          pass: config.password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: testEmail,
        subject,
        html: body,
      });

      return {
        success: true,
        message: 'Test email sent successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'SMTP error';
      return {
        success: false,
        message: 'Failed to send test email',
        error: errorMessage,
      };
    }
  }

  /**
   * Test Resend configuration
   */
  private async testResend(
    config: ResendConfig,
    testEmail?: string,
    customMessage?: string,
    instanceName = 'DockPilot'
  ): Promise<TestResult> {
    if (!testEmail) {
      return {
        success: false,
        message: 'Test email required',
        error: 'testEmail is required for Resend notifications',
      };
    }

    const { subject, body } = this.buildTestMessage('resend', customMessage, instanceName);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.fromAddress,
          to: testEmail,
          subject,
          html: body,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ message: '' }))) as {
          message: string;
        };
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return {
        success: true,
        message: 'Test email sent successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Resend error';
      return {
        success: false,
        message: 'Failed to send test email via Resend',
        error: errorMessage,
      };
    }
  }

  /**
   * Test Slack configuration
   */
  private async testSlack(
    config: SlackConfig,
    customMessage?: string,
    instanceName = 'DockPilot'
  ): Promise<TestResult> {
    const { body } = this.buildTestMessage('slack', customMessage, instanceName);

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: body,
          username: 'DockPilot',
          icon_emoji: ':test_tube:',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        success: true,
        message: 'Test message sent successfully to Slack',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Slack error';
      return {
        success: false,
        message: 'Failed to send test message to Slack',
        error: errorMessage,
      };
    }
  }

  /**
   * Test Telegram configuration
   */
  private async testTelegram(
    config: TelegramConfig,
    customMessage?: string,
    instanceName = 'DockPilot'
  ): Promise<TestResult> {
    const { body } = this.buildTestMessage('telegram', customMessage, instanceName);

    try {
      const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: body,
          parse_mode: 'HTML',
        }),
      });

      const data = (await response.json()) as { ok: boolean; description?: string };

      if (!data.ok) {
        throw new Error(data.description || 'Telegram API error');
      }

      return {
        success: true,
        message: 'Test message sent successfully to Telegram',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Telegram error';
      return {
        success: false,
        message: 'Failed to send test message to Telegram',
        error: errorMessage,
      };
    }
  }

  /**
   * Test Discord configuration
   */
  private async testDiscord(
    config: DiscordConfig,
    customMessage?: string,
    instanceName = 'DockPilot'
  ): Promise<TestResult> {
    const { body } = this.buildTestMessage('discord', customMessage, instanceName);

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: body,
          username: 'DockPilot',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return {
        success: true,
        message: 'Test message sent successfully to Discord',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Discord error';
      return {
        success: false,
        message: 'Failed to send test message to Discord',
        error: errorMessage,
      };
    }
  }
}
