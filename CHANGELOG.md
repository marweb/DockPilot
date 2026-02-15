# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-02-15

### Added

- Automatic event notification system
- 30+ notification events across 5 categories
- Event-channel mapping matrix UI
- Notification history and tracking
- Cooldown periods for deduplication
- Retry mechanism with exponential backoff
- Severity-based filtering (info/warning/critical)
- Event dispatcher with async processing

### Changed

- Enhanced Settings page with Events tab
- Updated notification channels with event support
- Improved error handling in notification service

### Security

- Added security event notifications
- Brute force attack detection
- Unauthorized access alerts

## [1.0.0] - 2024-01-XX

### Added

- Initial release
- Container management (create, start, stop, delete)
- Image management
- Volume and network management
- Docker Compose support
- Repository deployment
- Webhook integration
- RBAC authentication
- Audit logging
