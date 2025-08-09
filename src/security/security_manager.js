
import validator from 'validator';
import {promises as fs} from 'fs';

/**
 * Security Manager with Discord User ID tracking and banning
 * Handles both IP-based and Discord ID-based security threats
 */
class SecurityManager {
    constructor(options = {}) {
        this.logPath = options.logPath || './security.log';
        this.banListPath = options.banListPath || './banned_devices.json';
        this.discordBanListPath = options.discordBanListPath || './banned_discord_users.json';
        this.discordClient = options.discordClient || null;
        this.securityChannel = options.securityChannel || null;
        this.guildIds = options.guildIds || []; // Array of guild IDs where bot has ban permissions
        this.lang = options.languageDataset;

        // Storage sets for banned entities
        this.bannedDevices = new Set();
        this.bannedDiscordUsers = new Set();

        // Threat patterns
        this.suspiciousPatterns = [
            /\$[a-zA-Z]+/g,  // MongoDB operators
            /\.\./g,          // Path traversal
            /<script/gi,      // XSS attempts
            /javascript:/gi,  // JavaScript protocol
            /eval\(/gi,       // Code execution
            /function\(/gi,   // Function declarations
        ];

        this.dangerousOperators = [
            '$where', '$regex', '$expr', '$function', '$accumulator',
            '$addFields', '$bucket', '$bucketAuto', '$collStats',
            '$currentOp', '$facet', '$geoNear', '$graphLookup',
            '$indexStats', '$listLocalSessions', '$listSessions',
            '$merge', '$out', '$planCacheStats', '$redact', '$replaceRoot',
            '$sample', '$unionWith'
        ];

        this.loadBannedEntities();
    }

    /**
     * Main sanitization function with enhanced threat assessment
     */
    async sanitizeInput(input, context = {}) {
        const originalInput = this.safeStringify(input);
        let sanitizedInput = this.deepSanitize(input);

        // Get threat information
        const threatLevel = this.assessThreat(originalInput, sanitizedInput);
        const attackSource = this.identifyAttackSource(context);

        if (threatLevel > 0) {
            await this.handleThreat(threatLevel, originalInput, context, attackSource);
        }

        return sanitizedInput;
    }

    /**
     * Identify attack source (Discord user, IP, etc.)
     */
    identifyAttackSource(context) {
        const source = {
            type: 'unknown',
            identifier: null,
            discordUserId: null,
            discordGuildId: null,
            ipAddress: null,
            userAgent: null
        };

        // Check for Discord.js context
        if (context.interaction) {
            source.type = 'discord_interaction';
            source.discordUserId = context.interaction.user.id;
            source.discordGuildId = context.interaction.guild?.id;
            source.identifier = context.interaction.user.id;
        } else if (context.message && context.message.author) {
            source.type = 'discord_message';
            source.discordUserId = context.message.author.id;
            source.discordGuildId = context.message.guild?.id;
            source.identifier = context.message.author.id;
        } else if (context.req) {
            // HTTP request context
            source.type = 'http_request';
            source.ipAddress = context.req.ip || context.req.connection.remoteAddress;
            source.userAgent = context.req.get('User-Agent');
            source.identifier = source.ipAddress;
        } else if (context.socket) {
            // Socket.IO context
            source.type = 'socket_io';
            source.ipAddress = context.socket.handshake.address;
            source.userAgent = context.socket.handshake.headers['user-agent'];
            source.identifier = source.ipAddress;
        }

        return source;
    }

    /**
     * Enhanced threat handling with Discord user banning
     */
    async handleThreat(threatLevel, originalInput, attackSource) {
        const timestamp = new Date().toISOString();

        const logEntry = {
            timestamp,
            threatLevel,
            input: originalInput,
            attackSource,
            action: this.determineAction(threatLevel)
        };

        // Log the incident
        await this.logIncident(logEntry);

        // Take action based on threat level and source
        if (threatLevel >= 5) {
            // High threat - ban the attacker
            await this.banAttacker(attackSource, logEntry);
            await this.sendAlarm(logEntry);
        } else if (threatLevel >= 2) {
            // Medium threat - warning
            await this.sendWarning(logEntry);
        }
    }

    /**
     * Ban attacker based on source type
     */
    async banAttacker(attackSource, logEntry) {
        switch (attackSource.type) {
            case 'discord_interaction':
                await this.banDiscordUser(attackSource.discordUserId, attackSource.discordGuildId, logEntry);
                break;
            case 'discord_message':
                await this.banDiscordUser(attackSource.discordUserId, attackSource.discordGuildId, logEntry);
                break;
            case 'http_request':
            case 'socket_io':
                await this.banIPAddress(attackSource.ipAddress, logEntry);
                break;
            default:
                console.log(this.lang.UnkAtcSrc, attackSource.type);
        }
    }

    /**
     * Ban Discord user across all guilds where bot has permissions
     */
    async banDiscordUser(userId, logEntry) {
        if (!this.discordClient) {
            console.log(this.lang.UnavDscClient);
            return;
        }

        // Add to banned users list
        this.bannedDiscordUsers.add(userId);
        await this.saveBannedDiscordUsers();

        const banReason = `${this.lang.BanReasonNoSQLInj}${logEntry.threatLevel}`;
        let bannedGuilds = 0;
        let totalGuilds = 0;

        // Get all guilds or use specified guild IDs
        const guildsToCheck = this.guildIds.length > 0 
            ? this.guildIds.map(id => this.discordClient.guilds.cache.get(id)).filter(Boolean)
            : this.discordClient.guilds.cache.values();

        for (const guild of guildsToCheck) {
            totalGuilds++;
            try {
                // Check if bot has ban permissions
                const botMember = guild.members.cache.get(this.discordClient.user.id);
                if (!botMember?.permissions.has('BAN_MEMBERS')) {
                    console.log(`${this.lang.NoBanPerm}${guild.name}`);
                    continue;
                }

                // Check if user is already banned
                const existingBan = await guild.bans.fetch(userId).catch(() => null);
                if (existingBan) {
                    console.log(`${this.lang.UserID}${userId}${this.lang.UserAlreadyBanned}${guild.name}`);
                    bannedGuilds++;
                    continue;
                }

                // Ban the user
                await guild.members.ban(userId, { 
                    reason: banReason,
                    deleteMessageSeconds: 7 * 24 * 60 * 60 // Delete 7 days of messages
                });

                bannedGuilds++;
                console.log(`${this.lang.UserID}${userId}${this.lang.UserBanned}${guild.name}`);

                // Send announcement to guild's security channel if configured
                await this.announceDiscordBan(guild, userId, logEntry);

            } catch (error) {
                console.error(`${this.lang.ErrorBanning1}${userId}${this.lang.ErrorBannning2}${guild.name}:`, error.message);
            }
        }

        console.log(`${this.lang.DscBanComplete}${bannedGuilds}/${totalGuilds}`);

        // Update log entry with ban results
        logEntry.banResults = {
            discordUserId: userId,
            bannedGuilds,
            totalGuilds,
            banReason
        };
    }

    /**
     * Announce Discord ban to guild security channel
     */
    async announceDiscordBan(guild, userId, logEntry) {
        try {
            if (!this.securityChannel) {
                // Look for security/admin channels
                const securityChannels = guild.channels.cache.filter(channel => 
                    channel.type === 0 && // Text channel
                    (channel.name.includes('security') || 
                    channel.name.includes('admin') || 
                    channel.name.includes('mod-log') ||
                    channel.name.includes('ban-log')) ||
                    channel.name.includes("mod") ||
                    channel.name.includes("WTCW") ||
                    channel.name.includes("WT-CW")
                );

                const targetChannel = securityChannels.first();
                if (!targetChannel) return;
            }
            
            const embed = {
                title: this.lang.Embed.Title,
                color: 0xFF0000,
                timestamp: new Date().toISOString(),
                fields: [
                    {
                        name: this.lang.Embed.User,
                        value: `<@${userId}> (${userId})`,
                        inline: true
                    },
                    {
                        name: this.lang.Embed.ThreatLev,
                        value: logEntry.threatLevel.toString(),
                        inline: true
                    },
                    {
                        name: this.lang.Embed.Type,
                        value: this.lamg.Embed.NoSQLInj,
                        inline: true
                    },
                    {
                        name: this.lang.Embed.Payload,
                        value: '```json\n' + logEntry.input.substring(0, 800) + '\n```',
                        inline: false
                    }
                ],
                footer: {
                    text: this.lang.Embed.Footer
                }
            };

            await targetChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(this.lang.ErrorAnnounceDscBan, error);
        }
    }

    /**
     * Ban IP address (existing functionality)
     */
    async banIPAddress(ipAddress, logEntry) {
        if (!ipAddress) return;

        this.bannedDevices.add(ipAddress);
        await this.saveBannedDevices();

        console.log(`${this.BannedIP}${ipAddress}`);
        logEntry.banResults = {
            ipAddress,
            banned: true
        };
    }

    /**
     * Check if Discord user is banned
     */
    isDiscordUserBanned(userId) {
        return this.bannedDiscordUsers.has(userId);
    }

    /**
     * Check if IP is banned
     */
    isIPBanned(ipAddress) {
        return this.bannedDevices.has(ipAddress);
    }

    /**
     * Enhanced security check for Discord interactions
     */
    async checkDiscordSecurity(interaction) {
        const userId = interaction.user.id;

        if (this.isDiscordUserBanned(userId)) {
            // User is banned - reject interaction
            try {
                await interaction.reply({
                    content: this.lang.BannedInteraction,
                    ephemeral: true
                });
            } catch (error) {
                console.error(this.lang.ErrorBannedInt, error);
            }
            return false;
        }

        return true;
    }

    /**
     * Load banned Discord users from storage
     */
    async loadBannedDiscordUsers() {
        try {
            const data = await fs.readFile(this.discordBanListPath, 'utf8');
            const bannedArray = JSON.parse(data);
            this.bannedDiscordUsers = new Set(bannedArray);
        } catch {
            this.bannedDiscordUsers = new Set();
        }
    }

    /**
     * Save banned Discord users to storage
     */
    async saveBannedDiscordUsers() {
        try {
            const bannedArray = Array.from(this.bannedDiscordUsers);
            await fs.writeFile(this.discordBanListPath, this.safeStringify(bannedArray, null, 2));
        } catch (error) {
            console.error(this.lang.ErrorSavingDscBan, error);
        }
    }

    /**
     * Load all banned entities
     */
    async loadBannedEntities() {
        await this.loadBannedDevices();
        await this.loadBannedDiscordUsers();
    }

    /**
     * Load banned devices (IPs, MACs)
     */
    async loadBannedDevices() {
        try {
            const data = await fs.readFile(this.banListPath, 'utf8');
            const bannedArray = JSON.parse(data);
            this.bannedDevices = new Set(bannedArray);
        } catch {
            this.bannedDevices = new Set();
        }
    }

    /**
     * Save banned devices
     */
    async saveBannedDevices() {
        try {
            const bannedArray = Array.from(this.bannedDevices);
            await fs.writeFile(this.banListPath, this.safeStringify(bannedArray, null, 2));
        } catch (error) {
            console.error(this.lang.ErrorSavingDev, error);
        }
    }

    /**
     * Deep sanitization (existing functionality)
     */
    deepSanitize(obj) {
        if (typeof obj === 'string') {
            return this.sanitizeString(obj);
        }

        if (typeof obj === 'bigint') {
            return obj.toString();
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepSanitize(item));
        }

        if (obj && typeof obj === 'object') {
            const sanitized = {};

            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith('$')) {
                    const isLegitimate = this.isLegitimateOperator(key, value, obj);
                    if (!isLegitimate) {
                        continue;
                    }
                }

                const sanitizedKey = this.sanitizeString(key);
                sanitized[sanitizedKey] = this.deepSanitize(value);
            }

            return sanitized;
        }

        return obj;
    }

    /**
     * String sanitization
     */
    sanitizeString(str) {
        if (typeof str !== 'string') return str;

        let sanitized = str;
        sanitized = validator.escape(sanitized);
        sanitized = sanitized.replace(/\$(?![0-9])/g, '&#36;');

        return sanitized;
    }

    /**
     * Check operator legitimacy
     */
    isLegitimateOperator(operator, value) {
        if (this.dangerousOperators.includes(operator)) {
            return false;
        }

        const legitimatePatterns = [
            (op, val) => ['$gt', '$gte', '$lt', '$lte'].includes(op) && (typeof val === 'number' || !isNaN(Date.parse(val))),
            (op, val) => op === '$exists' && typeof val === 'boolean',
            (op, val) => ['$eq', '$ne'].includes(op) && typeof val !== 'object',
            (op, val) => ['$in', '$nin'].includes(op) && Array.isArray(val) && val.every(v => typeof v !== 'object')
        ];

        return legitimatePatterns.some(pattern => pattern(operator, value));
    }

    /**
     * Assess threat level
     */
    assessThreat(original, sanitized) {
        let threatLevel = 0;

        if (original !== sanitized) {
            threatLevel += 1;
        }

        this.suspiciousPatterns.forEach(pattern => {
            if (pattern.test(original)) {
                threatLevel += 2;
            }
        });

        this.dangerousOperators.forEach(op => {
            if (original.includes(op)) {
                threatLevel += 3;
            }
        });

        const injectionIndicators = (original.match(/\$[a-zA-Z]+/g) || []).length;
        if (injectionIndicators > 3) {
            threatLevel += 5;
        }

        return threatLevel;
    }

    /**
     * Determine action based on threat level
     */
    determineAction(threatLevel) {
        if (threatLevel >= 10) return 'BAN_AND_ALARM';
        if (threatLevel >= 5) return 'BAN_AND_NOTIFY';
        if (threatLevel >= 2) return 'LOG_AND_WARN';
        return 'LOG_ONLY';
    }

    /**
     * Log incident
     */
    async logIncident(logEntry) {
        try {
            const logLine = this.safeStringify(logEntry) + '\n';
            await fs.appendFile(this.logPath, logLine);
        } catch (error) {
            console.error(this.lang.ErrorLogingInc, error);
        }
    }

    /**
     * Send alarm (placeholder - implement with Discord webhook)
     */
    async sendAlarm(logEntry) {
        console.log('🚨 SECURITY ALARM:', logEntry);
        // Implement Discord webhook notification here
    }

    /**
     * Send warning (placeholder)
     */
    async sendWarning(logEntry) {
        console.log('⚠️ Security Warning:', logEntry);
        // Implement Discord warning notification here
    }

    /**
     * Unban Discord user (for moderation purposes)
     */
    async unbanDiscordUser(userId, reason = 'Manual unban') {
        this.bannedDiscordUsers.delete(userId);
        await this.saveBannedDiscordUsers();

        if (!this.discordClient) return;

        let unbannedGuilds = 0;
        let totalGuilds = 0;

        const guildsToCheck = this.guildIds.length > 0 
            ? this.guildIds.map(id => this.discordClient.guilds.cache.get(id)).filter(Boolean)
            : this.discordClient.guilds.cache.values();

        for (const guild of guildsToCheck) {
            totalGuilds++;
            try {
                const botMember = guild.members.cache.get(this.discordClient.user.id);
                if (!botMember?.permissions.has('BAN_MEMBERS')) continue;

                await guild.members.unban(userId, reason);
                unbannedGuilds++;
                console.log(`${this.lang.UserID}${userId}${this.lang.UnbanUser}${guild.name}`);

            } catch (error) {
                // User might not be banned in this guild
                console.log(`${this.lang.UserID}${userId}${this.lang.ErrorUnbanUser}${guild.name}: ${error.message}`);
            }
        }

        console.log(`${this.lang.UnbanComplete}${unbannedGuilds}/${totalGuilds}`);
        return { unbannedGuilds, totalGuilds };
    }

    safeStringify(data) {
    const seen = new WeakSet();

    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }

        if (typeof value === 'bigint') {
            return value.toString();
        }

        if (typeof value === 'symbol') {
            return value.description || value.toString();
        }

        if (typeof value === 'function') {
            return `[Function${value.name ? ': ' + value.name : ''}]`;
        }

        if (typeof value === 'undefined') {
            return '[undefined]';
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (value instanceof RegExp) {
            return value.toString();
        }

        return value;
        }, 2);
    }

}

export default SecurityManager;
