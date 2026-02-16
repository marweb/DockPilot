# ADR-001: Modelo de Configuración del Sistema y Notificaciones

**Estado:** Propuesto  
**Fecha:** 2026-02-15  
**Autor:** Equipo DockerPilot

## Contexto

DockerPilot requiere un sistema robusto de configuración que permita gestionar parámetros del sistema y canales de notificación de manera segura, flexible y extensible. Este ADR define el modelo de datos, esquema de almacenamiento, mecanismos de cifrado y diseño de API para cumplir con estos requisitos.

## Decisiones

### 1. Separación de Responsabilidades

Hemos decidido separar la configuración en dos dominios principales:

- **Configuración del Sistema (`system_settings`)**: Parámetros generales de la instancia DockerPilot
- **Canales de Notificación (`notification_channels`)**: Configuración de proveedores de notificaciones (SMTP, Slack, etc.)

Esta separación permite gestión granular de permisos y facilita la extensibilidad futura.

### 2. Almacenamiento Key-Value vs. Estructurado

- **Configuración simple**: Almacenamiento key-value en `system_settings` para máxima flexibilidad
- **Canales de notificación**: Tabla estructurada con campos específicos para validación y tipado fuerte

### 3. Esquema de Cifrado

Implementamos cifrado AES-256-GCM para campos sensibles con el siguiente formato:

```
enc:<base64(iv:tag:ciphertext)>
```

## Estructura de Datos

### 1. Configuración del Sistema

```typescript
interface SystemConfig {
  instanceName: string; // Nombre identificador de la instancia DockerPilot
  publicUrl: string; // URL pública completa (ej: https://dockpilot.miempresa.com)
  timezone: string; // Zona horaria IANA (ej: America/Panama, America/New_York)
  publicIPv4?: string; // IP pública IPv4 (auto-detectada o manual)
  publicIPv6?: string; // IP pública IPv6 (auto-detectada o manual)
  autoUpdate: boolean; // Habilitar actualizaciones automáticas del sistema
}
```

**Mapeo a tabla `system_settings`:**

| key             | value_type | value_string             | value_boolean |
| --------------- | ---------- | ------------------------ | ------------- |
| `instance_name` | string     | "Mi DockerPilot"         | NULL          |
| `public_url`    | string     | "https://dp.ejemplo.com" | NULL          |
| `timezone`      | string     | "America/Panama"         | NULL          |
| `public_ipv4`   | string     | "203.0.113.1"            | NULL          |
| `public_ipv6`   | string     | "2001:db8::1"            | NULL          |
| `auto_update`   | boolean    | NULL                     | true          |

### 2. Canales de Notificación

```typescript
interface NotificationChannels {
  // Email - SMTP
  smtp?: {
    host: string;
    port: number;
    username: string;
    password: string; // CIFRADO
    encryption: 'none' | 'ssl' | 'tls' | 'starttls';
    fromName: string;
    fromAddress: string;
  };

  // Email - Resend
  resend?: {
    apiKey: string; // CIFRADO
    fromAddress: string;
  };

  // Mensajería - Slack
  slack?: {
    webhookUrl: string; // CIFRADO
  };

  // Mensajería - Telegram
  telegram?: {
    botToken: string; // CIFRADO
    chatId: string;
  };

  // Mensajería - Discord
  discord?: {
    webhookUrl: string; // CIFRADO
  };
}
```

**Mapeo a tabla `notification_channels`:**

| Campo              | Tipo        | Nullable | Descripción                                  |
| ------------------ | ----------- | -------- | -------------------------------------------- |
| `id`               | UUID        | NO       | PK autogenerada                              |
| `channel_type`     | VARCHAR(20) | NO       | Tipo: smtp, resend, slack, telegram, discord |
| `is_enabled`       | BOOLEAN     | NO       | Default: false                               |
| `config`           | JSONB       | NO       | Configuración específica del canal           |
| `encrypted_fields` | JSONB       | YES      | Lista de campos cifrados en config           |
| `created_at`       | TIMESTAMP   | NO       | -                                            |
| `updated_at`       | TIMESTAMP   | NO       | -                                            |

**Ejemplo de registro SMTP:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "channel_type": "smtp",
  "is_enabled": true,
  "config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "notifications@ejemplo.com",
    "password": "enc:QUVTLUdDTV5eYjU0Zjc4...base64...",
    "encryption": "starttls",
    "fromName": "DockerPilot",
    "fromAddress": "notifications@ejemplo.com"
  },
  "encrypted_fields": ["password"],
  "created_at": "2026-02-15T10:00:00Z",
  "updated_at": "2026-02-15T10:00:00Z"
}
```

## Esquema de Cifrado

### Algoritmo

- **Algoritmo**: AES-256-GCM
- **Key**: `MASTER_KEY` (proporcionada via variable de entorno)
- **IV**: 12 bytes aleatorios por cada operación de cifrado
- **Tag**: 16 bytes de autenticación GCM

### Campos que REQUIEREN cifrado:

| Canal    | Campos Cifrados |
| -------- | --------------- |
| SMTP     | `password`      |
| Resend   | `apiKey`        |
| Slack    | `webhookUrl`    |
| Telegram | `botToken`      |
| Discord  | `webhookUrl`    |

### Formato de Cifrado

```
enc:<base64(iv:tag:ciphertext)>
```

Donde:

- `enc:`: Prefijo obligatorio para identificar campo cifrado
- `base64()`: Codificación base64 de la concatenación
- `iv`: 12 bytes (nonce)
- `tag`: 16 bytes (autenticación GCM)
- `ciphertext`: Datos cifrados

**Ejemplo de implementación en Node.js:**

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encrypt(plaintext: string, masterKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(masterKey, 'salt', 32);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'base64')]);

  return `enc:${combined.toString('base64')}`;
}

function decrypt(encryptedValue: string, masterKey: string): string {
  if (!encryptedValue.startsWith('enc:')) {
    throw new Error('Invalid encrypted format');
  }

  const data = Buffer.from(encryptedValue.slice(4), 'base64');
  const iv = data.slice(0, IV_LENGTH);
  const tag = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.slice(IV_LENGTH + TAG_LENGTH);

  const key = scryptSync(masterKey, 'salt', 32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

## Compatibilidad con `meta` Legacy

El campo `meta` JSON en registros existentes se mantiene SOLO LECTURA para backwards compatibility:

```typescript
// Al leer registros antiguos
if (record.meta && record.meta.notification_config) {
  // Migrar a nueva estructura
  const legacyConfig = record.meta.notification_config;
  // Transformar y guardar en notification_channels
}

// Nunca escribir nuevos datos en meta.notification_config
```

**Regla de oro**: `meta` es READ-ONLY para notificaciones. Toda escritura va a tablas dedicadas.

## Diseño de API

### 1. GET /api/system/settings

**Descripción:** Obtiene configuración del sistema

**Response:**

```json
{
  "instanceName": "Mi DockerPilot",
  "publicUrl": "https://dockpilot.miempresa.com",
  "timezone": "America/Panama",
  "publicIPv4": "203.0.113.1",
  "publicIPv6": null,
  "autoUpdate": true
}
```

**Código de respuesta:** 200 OK

### 2. PUT /api/system/settings

**Descripción:** Actualiza configuración del sistema

**Request Body:**

```json
{
  "instanceName": "Mi DockerPilot",
  "publicUrl": "https://dockpilot.miempresa.com",
  "timezone": "America/Panama",
  "publicIPv4": "203.0.113.1",
  "publicIPv6": "2001:db8::1",
  "autoUpdate": true
}
```

**Validaciones:**

- `publicUrl`: URL válida con protocolo https/http
- `timezone`: Zona horaria válida de la base de datos IANA
- `publicIPv4`: IPv4 válida o null
- `publicIPv6`: IPv6 válida o null
- `autoUpdate`: boolean

**Response:** 200 OK con objeto actualizado

### 3. GET /api/system/notifications/config

**Descripción:** Obtiene configuración de canales de notificación

**Response:**

```json
{
  "channels": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "smtp",
      "enabled": true,
      "config": {
        "host": "smtp.gmail.com",
        "port": 587,
        "username": "notifications@ejemplo.com",
        "password": "***ENCRYPTED***",
        "encryption": "starttls",
        "fromName": "DockerPilot",
        "fromAddress": "notifications@ejemplo.com"
      }
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "type": "slack",
      "enabled": true,
      "config": {
        "webhookUrl": "***ENCRYPTED***"
      }
    }
  ]
}
```

**Nota:** Los campos cifrados se retornan con máscara `***ENCRYPTED***` por seguridad.

### 4. PUT /api/system/notifications/config

**Descripción:** Actualiza o crea canales de notificación

**Request Body (ejemplo SMTP):**

```json
{
  "channels": [
    {
      "type": "smtp",
      "enabled": true,
      "config": {
        "host": "smtp.gmail.com",
        "port": 587,
        "username": "notifications@ejemplo.com",
        "password": "miPasswordSeguro123",
        "encryption": "starttls",
        "fromName": "DockerPilot",
        "fromAddress": "notifications@ejemplo.com"
      }
    }
  ]
}
```

**Request Body (ejemplo Resend):**

```json
{
  "channels": [
    {
      "type": "resend",
      "enabled": true,
      "config": {
        "apiKey": "re_1234567890abcdef",
        "fromAddress": "notifications@ejemplo.com"
      }
    }
  ]
}
```

**Request Body (ejemplo Slack):**

```json
{
  "channels": [
    {
      "type": "slack",
      "enabled": true,
      "config": {
        "webhookUrl": "https://example.com/webhooks/slack/PLACEHOLDER"
      }
    }
  ]
}
```

**Request Body (ejemplo Telegram):**

```json
{
  "channels": [
    {
      "type": "telegram",
      "enabled": true,
      "config": {
        "botToken": "1234567890:ABCDEFghijklmnopQRSTuvwxyz123456789",
        "chatId": "-1001234567890"
      }
    }
  ]
}
```

**Request Body (ejemplo Discord):**

```json
{
  "channels": [
    {
      "type": "discord",
      "enabled": true,
      "config": {
        "webhookUrl": "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz"
      }
    }
  ]
}
```

**Validaciones:**

- `type`: Debe ser uno de los valores permitidos (smtp, resend, slack, telegram, discord)
- `enabled`: boolean
- Campos específicos según tipo (ver definiciones arriba)

**Procesamiento:**

1. Validar request body
2. Para cada campo sensible, aplicar cifrado antes de guardar
3. Actualizar registro existente o crear nuevo
4. Retornar configuración con campos sensibles enmascarados

**Response:** 200 OK con objeto actualizado

### 5. POST /api/system/notifications/test

**Descripción:** Envía notificación de prueba al canal especificado

**Request Body:**

```json
{
  "channelId": "550e8400-e29b-41d4-a716-446655440000",
  "testMessage": "Este es un mensaje de prueba desde DockerPilot"
}
```

**Response Success:**

```json
{
  "success": true,
  "message": "Notificación enviada exitosamente",
  "timestamp": "2026-02-15T10:30:00Z"
}
```

**Response Error:**

```json
{
  "success": false,
  "error": "No se pudo conectar al servidor SMTP: Connection refused",
  "timestamp": "2026-02-15T10:30:00Z"
}
```

**Códigos de respuesta:**

- 200: Test ejecutado (revisar success en body)
- 404: Canal no encontrado
- 400: Canal deshabilitado o configuración inválida

## Consideraciones de Seguridad

1. **MASTER_KEY:**
   - Debe tener al menos 32 caracteres
   - Almacenada en variable de entorno `DOCKPILOT_MASTER_KEY`
   - NUNCA loguear ni exponer en APIs

2. **Validación de entrada:**
   - Sanitizar todas las URLs
   - Validar formatos de email
   - Verificar rangos de puertos (1-65535)

3. **Rate Limiting:**
   - Endpoint de test: máximo 5 intentos por minuto
   - Prevenir abuso de envío de notificaciones

4. **Auditoría:**
   - Loguear cambios en configuración (sin valores cifrados)
   - Registrar quién y cuándo modificó canales

## Migración de Datos

Para migrar desde configuración legacy en `meta`:

```sql
-- Migrar configuración del sistema desde meta
INSERT INTO system_settings (key, value_type, value_string, value_boolean)
SELECT
  'instance_name' as key,
  'string' as value_type,
  meta->>'instance_name' as value_string,
  NULL as value_boolean
FROM legacy_config
WHERE meta->>'instance_name' IS NOT NULL;

-- Migrar canales de notificación
INSERT INTO notification_channels (id, channel_type, is_enabled, config, encrypted_fields)
SELECT
  gen_random_uuid(),
  'smtp' as channel_type,
  true as is_enabled,
  jsonb_build_object(
    'host', meta->'notifications'->>'smtp_host',
    'port', (meta->'notifications'->>'smtp_port')::int,
    'username', meta->'notifications'->>'smtp_user',
    'password', encrypt(meta->'notifications'->>'smtp_pass'),
    'encryption', meta->'notifications'->>'smtp_encryption',
    'fromName', meta->'notifications'->>'from_name',
    'fromAddress', meta->'notifications'->>'from_email'
  ) as config,
  '["password"]'::jsonb as encrypted_fields
FROM legacy_config
WHERE meta->'notifications'->>'smtp_host' IS NOT NULL;
```

## Ejemplo de Implementación TypeScript

```typescript
// services/config.service.ts
export class ConfigService {
  async getSystemSettings(): Promise<SystemConfig> {
    const settings = await db.query(`
      SELECT key, value_string, value_boolean 
      FROM system_settings
    `);

    return this.transformToSystemConfig(settings.rows);
  }

  async updateSystemSettings(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const updates = Object.entries(config).map(([key, value]) => {
      const dbKey = this.toSnakeCase(key);
      const type = typeof value === 'boolean' ? 'boolean' : 'string';
      return {
        key: dbKey,
        value_type: type,
        value_string: type === 'string' ? value : null,
        value_boolean: type === 'boolean' ? value : null,
      };
    });

    // Upsert en una transacción
    await db.transaction(async (trx) => {
      for (const update of updates) {
        await trx.query(
          `
          INSERT INTO system_settings (key, value_type, value_string, value_boolean)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (key) DO UPDATE SET
            value_type = EXCLUDED.value_type,
            value_string = EXCLUDED.value_string,
            value_boolean = EXCLUDED.value_boolean,
            updated_at = NOW()
        `,
          [update.key, update.value_type, update.value_string, update.value_boolean]
        );
      }
    });

    return this.getSystemSettings();
  }
}

// services/notification.service.ts
export class NotificationService {
  private encryptionService: EncryptionService;

  async getChannels(): Promise<NotificationChannel[]> {
    const channels = await db.query(`
      SELECT * FROM notification_channels WHERE is_enabled = true
    `);

    return channels.rows.map((channel) => ({
      ...channel,
      config: this.maskEncryptedFields(channel.config, channel.encrypted_fields),
    }));
  }

  async saveChannel(channel: NotificationChannelInput): Promise<NotificationChannel> {
    const config = { ...channel.config };
    const encryptedFields: string[] = [];

    // Cifrar campos sensibles
    for (const [key, value] of Object.entries(config)) {
      if (this.isSensitiveField(channel.type, key)) {
        config[key] = this.encryptionService.encrypt(value);
        encryptedFields.push(key);
      }
    }

    const result = await db.query(
      `
      INSERT INTO notification_channels (id, channel_type, is_enabled, config, encrypted_fields)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (channel_type) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        config = EXCLUDED.config,
        encrypted_fields = EXCLUDED.encrypted_fields,
        updated_at = NOW()
      RETURNING *
    `,
      [channel.id || generateUUID(), channel.type, channel.enabled, config, encryptedFields]
    );

    return this.maskEncryptedFields(result.rows[0]);
  }

  private isSensitiveField(channelType: string, field: string): boolean {
    const sensitiveFields: Record<string, string[]> = {
      smtp: ['password'],
      resend: ['apiKey'],
      slack: ['webhookUrl'],
      telegram: ['botToken'],
      discord: ['webhookUrl'],
    };

    return sensitiveFields[channelType]?.includes(field) || false;
  }

  private maskEncryptedFields(channel: any): any {
    const masked = { ...channel };
    for (const field of channel.encrypted_fields || []) {
      masked.config[field] = '***ENCRYPTED***';
    }
    return masked;
  }
}
```

## Consecuencias

### Positivas

- ✅ Separación clara de responsabilidades
- ✅ Cifrado robusto para datos sensibles
- ✅ Flexibilidad para agregar nuevos canales
- ✅ Compatibilidad hacia atrás con meta legacy
- ✅ API RESTful consistente
- ✅ Facilidad de testing con endpoint dedicado

### Negativas

- ⚠️ Complejidad adicional vs configuración simple en JSON
- ⚠️ Requiere MASTER_KEY configurada obligatoriamente
- ⚠️ Migración necesaria desde configuración legacy

## Referencias

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [NIST SP 800-38D - AES-GCM](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Resend API Documentation](https://resend.com/docs)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
