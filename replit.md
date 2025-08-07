# Discord Moderation Bot

## Overview

This is a Turkish Discord moderation bot built with Discord.js v14. The bot provides essential moderation commands including kick, ban, mute, unmute, and message clearing functionality. It supports both traditional prefix commands and modern Discord slash commands, with comprehensive permission checking and logging capabilities.

## Recent Changes

- Removed "Yetki Al" option and kept only "Tüm Rolleri Al" for role removal punishment (2025-08-05)
- Simplified punishment system now offers: warn, kick, ban, removeall (all roles)
- Fixed ban protection command error when using "removeall" punishment option
- Added detailed logging for every ban and kick action, not just abuse cases (2025-08-05)
- Every ban/kick now generates individual log entry with moderator, target, reason, method, and timestamp
- Separate log types: 'ban_action'/'kick_action' for normal operations, abuse logs for violations
- Enhanced audit log tracking shows all moderation activities in real-time
- Restricted all security commands to server owner only access (2025-08-05)
- Only server owner can use banprotection, kickprotection, antiraid, and protectionlog commands
- Enhanced security to prevent moderator abuse of protection systems
- Added comprehensive kick abuse protection system with audit log monitoring (2025-08-05)
- Kick protection works identical to ban protection but tracks kick operations
- System monitors ALL kick activities including manual Discord interface kicks
- Added kickprotection command with enable/disable/status/history functionality
- Expanded protection log system to include kick abuse monitoring
- Added dedicated protection system log channels with protectionlog command (2025-08-05)
- Each protection system (ban abuse, kick abuse, anti-raid) can have separate log channels
- Centralized log management system with LogManager utility for organized logging
- Fixed config.json structure with proper embedColors and protectionLogChannels sections
- Added comprehensive audit log-based ban abuse monitoring (2025-08-05)
- System now tracks ALL ban activities including manual Discord bans, not just bot commands
- Audit log handler automatically detects ban abuse across all ban methods
- Ban protection applies to both bot commands and manual Discord interface bans
- Added comprehensive ban protection system with confirmation buttons (2025-08-05)
- Ban protection requires confirmation for banning high-privileged users
- Interactive button-based confirmation system for slash commands
- Automatic timeout cleanup for pending ban requests
- Added comprehensive anti-raid protection system (2025-08-05)
- Anti-raid system monitors rapid user joins and sends automatic alerts
- Automatic suspicious account detection and potential auto-kick for very new accounts
- Added server owner special privileges for kick and ban commands (2025-08-05)
- Server owner can now moderate users with equal or higher roles (bot permissions allowing)
- Fixed duplicate command execution issue by removing redundant workflow (2025-08-05)
- Bot successfully deployed and tested with all moderation commands working
- Hybrid command system confirmed working for both prefix (!) and slash (/) commands

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Discord.js v14**: Modern Discord API wrapper with full intents support
- **Dual Command System**: Supports both prefix commands (!command) and slash commands (/command)
- **Event-Driven Architecture**: Separate handlers for different interaction types

### Command Structure
- **Hybrid Commands**: Each command supports both prefix and slash command execution through a unified interface
- **Permission System**: Multi-layered permission checking using both Discord permissions and custom moderator roles
- **Input Validation**: Comprehensive validation for user inputs, time limits, and argument parsing

### Permission Model
- **Role-Based Access**: Configurable moderator roles defined in config.json
- **Discord Permission Integration**: Falls back to native Discord permissions when role-based access fails
- **Hierarchical Checking**: Server owners have ultimate authority, followed by moderator roles, then Discord permissions

### Logging System
- **File-Based Logging**: Daily log files with timestamp formatting
- **Multi-Level Logging**: Info, warning, and error levels with different console outputs
- **Error Handling**: Comprehensive error catching with detailed stack traces

### Configuration Management
- **JSON Configuration**: Centralized configuration file for bot settings
- **Customizable Settings**: Prefix, moderator roles, mute role, log channel, and embed colors
- **Environment Separation**: Token management separate from other configurations

### Moderation Features
- **User Management**: Kick and ban with reason tracking and message history deletion options
- **Timeout System**: Temporary mutes with configurable duration (1-10080 minutes)
- **Message Management**: Bulk message deletion with optional user filtering
- **Audit Logging**: All moderation actions logged with user details and reasons

### Error Handling
- **Graceful Degradation**: Bot continues operating even when individual commands fail
- **User Feedback**: Clear error messages for both users and administrators
- **Recovery Mechanisms**: Automatic retry logic for failed operations

## External Dependencies

### Core Dependencies
- **discord.js**: Primary Discord API integration library
- **Node.js Built-ins**: File system operations, path handling, and logging utilities

### Discord API Integration
- **Gateway Intents**: Guilds, messages, members, and moderation events
- **Slash Command Registration**: Automatic command deployment to Discord
- **Permission Scopes**: Granular permission checking for moderation actions

### File System
- **Log Directory Management**: Automatic creation and management of log directories
- **Command Loading**: Dynamic command file discovery and loading
- **Configuration Reading**: JSON-based configuration file parsing

### No External Database
- **Stateless Design**: Bot operates without persistent data storage
- **Discord Native Storage**: Relies on Discord's built-in user and role management
- **Configuration File Storage**: Simple JSON file for bot settings