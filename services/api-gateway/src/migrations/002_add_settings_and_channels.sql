-- Tabla para settings del sistema (key-value con tipos)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para canales de notificación
CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT NOT NULL CHECK(provider IN ('smtp', 'resend', 'slack', 'telegram', 'discord')),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 0,
  config TEXT NOT NULL, -- JSON cifrado
  from_name TEXT,
  from_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_notification_channels_provider ON notification_channels(provider);
CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled);

-- Insertar settings por defecto
INSERT OR IGNORE INTO system_settings (key, value, type, description) VALUES
('instance_name', 'DockPilot', 'string', 'Nombre de la instancia'),
('public_url', '', 'string', 'URL pública de la instancia'),
('timezone', 'UTC', 'string', 'Zona horaria de la instancia'),
('public_ipv4', '', 'string', 'IP pública IPv4'),
('public_ipv6', '', 'string', 'IP pública IPv6'),
('auto_update', 'false', 'boolean', 'Actualizaciones automáticas habilitadas');
