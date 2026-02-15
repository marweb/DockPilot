-- Tabla para reglas de notificación (evento → canal)
CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  min_severity TEXT DEFAULT 'info' CHECK(min_severity IN ('info', 'warning', 'critical')),
  cooldown_minutes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
  UNIQUE(event_type, channel_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(enabled);

-- Tabla para historial de notificaciones enviadas (para deduplicación y tracking)
CREATE TABLE IF NOT EXISTS notification_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  recipients TEXT, -- JSON array de destinatarios
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'retrying')),
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE SET NULL
);

-- Índices para historial
CREATE INDEX IF NOT EXISTS idx_notification_history_event ON notification_history(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at);

-- Insertar reglas por defecto (todas deshabilitadas inicialmente)
INSERT OR IGNORE INTO notification_rules (event_type, channel_id, enabled, min_severity)
SELECT 
  'system.upgrade.failed' as event_type,
  nc.id as channel_id,
  0 as enabled,
  'critical' as min_severity
FROM notification_channels nc
WHERE nc.provider IN ('smtp', 'resend');