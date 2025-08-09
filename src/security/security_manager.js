import validator from 'validator';
import { promises as fs } from 'fs';

/**
 * Security Manager with Discord User ID tracking and banning
 * Handles both IP-based and Discord ID-based security threats
 */
class SecurityManager {
    constructor(options = {}) {
        this.logPath = options.logPath || './src/security/security.log';
        this.banListPath = options.banListPath || './src/security/banned_devices.json';
        this.discordBanListPath = options.discordBanListPath || './src/security/banned_discord_users.json';
        this.discordClient = options.discordClient || null;
        this.securityChannelId = options.securityChannelId || null; // pouze ID kanálu z JSONu
        this.guildIds = options.guildIds || [];
        this.lang = options.languageDataset;

        this.bannedDevices = new Set();
        this.bannedDiscordUsers = new Set();

        this.suspiciousPatterns = [
            /\$[a-zA-Z]+/g,
            /\.\./g,
            /<script/gi,
            /javascript:/gi,
            /eval\(/gi,
            /function\(/gi
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
        const originalInput = this.convertBigIntsToStrings(input);
        const preparedInput = structuredClone(originalInput);
        let sanitizedInput = this.deepSanitize(preparedInput);

        const threatLevel = this.assessThreat(originalInput, sanitizedInput);
        const attackSource = this.identifyAttackSource(context);

        if (threatLevel > 0) {
            await this.handleThreat(threatLevel, originalInput, attackSource);
        }

        return sanitizedInput;
    }

    /**
     * Converts BigInt values to strings.
     */
    convertBigIntsToStrings(obj) {
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(v => this.convertBigIntsToStrings(v));
        if (obj && typeof obj === 'object') {
            const converted = {};
            for (const [key, value] of Object.entries(obj)) {
                converted[key] = this.convertBigIntsToStrings(value);
            }
            return converted;
        }
        return obj;
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

        if (context.interaction) {
            source.type = 'discord_interaction';
            source.discordUserId = String(context.interaction.user.id);
            source.discordGuildId = String(context.interaction.guild?.id);
            source.identifier = String(context.interaction.user.id);
        } else if (context.message && context.message.author) {
            source.type = 'discord_message';
            source.discordUserId = String(context.message.author.id);
            source.discordGuildId = String(context.message.guild?.id);
            source.identifier = String(context.message.author.id);
        } else if (context.req) {
            source.type = 'http_request';
            source.ipAddress = context.req.ip || context.req.connection.remoteAddress;
            source.userAgent = context.req.get('User-Agent');
            source.identifier = source.ipAddress;
        } else if (context.socket) {
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

        await this.logIncident(logEntry);

        if (threatLevel >= 5) {
            await this.banAttacker(attackSource, logEntry);
            await this.sendAlarm(logEntry);
        } else if (threatLevel >= 2) {
            await this.sendWarning(logEntry);
        }
    }

    /**
     * Ban attacker based on source type
     */
    async banAttacker(attackSource, logEntry) {
        switch (attackSource.type) {
            case 'discord_interaction':
            case 'discord_message':
                await this.banDiscordUser(attackSource.discordUserId, logEntry);
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
        this.bannedDiscordUsers.add(userId);
        await this.saveBannedDiscordUsers();

        const banReason = `${this.lang.BanReasonNoSQLInj}${logEntry.threatLevel}`;
        let bannedGuilds = 0, totalGuilds = 0;

        const guildsToCheck = this.guildIds.length > 0
            ? this.guildIds.map(id => this.discordClient.guilds.cache.get(id)).filter(Boolean)
            : this.discordClient.guilds.cache.values();

        for (const guild of guildsToCheck) {
            totalGuilds++;
            try {
                const botMember = guild.members.cache.get(this.discordClient.user.id);
                if (!botMember?.permissions.has('BAN_MEMBERS')) {
                    console.log(`${this.lang.NoBanPerm}${guild.name}`);
                    continue;
                }

                const existingBan = await guild.bans.fetch(userId).catch(() => null);
                if (existingBan) {
                    console.log(`${this.lang.UserID}${userId}${this.lang.UserAlreadyBanned}${guild.name}`);
                    bannedGuilds++;
                    continue;
                }

                await guild.members.ban(userId, {
                    reason: banReason,
                    deleteMessageSeconds: 7 * 24 * 60 * 60
                });

                bannedGuilds++;
                console.log(`${this.lang.UserID}${userId}${this.lang.UserBanned}${guild.name}`);

                await this.announceDiscordBan(guild, userId, logEntry);

            } catch (error) {
                console.error(`${this.lang.ErrorBanning1}${userId}${this.lang.ErrorBannning2}${guild.name}:`, error.message);
            }
        }
        console.log(`${this.lang.DscBanComplete}${bannedGuilds}/${totalGuilds}`);
    }

    /**
     * Announce Discord ban to guild security channel
     */
async announceDiscordBan(guild, userId, logEntry) {
        try {
            const embed = {
                title: this.lang.Embed.Title,
                color: 0xFF0000,
                timestamp: new Date().toISOString(),
                fields: [
                    { name: this.lang.Embed.User, value: `<@${userId}> (${userId})`, inline: true },
                    { name: this.lang.Embed.ThreatLev, value: logEntry.threatLevel.toString(), inline: true },
                    { name: this.lang.Embed.Type, value: this.lang.Embed.NoSQLInj, inline: true },
                    { name: this.lang.Embed.Payload, value: '``````', inline: false }
                ],
                footer: { text: this.lang.Embed.Footer }
            };

            let targetChannel = null;

            if (this.securityChannelId) { // dohledání podle uloženého ID
                targetChannel = guild.channels.cache.get(this.securityChannelId) || null;
            }

            if (!targetChannel) {
                const securityChannels = guild.channels.cache.filter(channel =>
                    channel.type === 0 &&
                    (
                        channel.name.includes('security') ||
                        channel.name.includes('admin') ||
                        channel.name.includes('mod-log') ||
                        channel.name.includes('ban-log') ||
                        channel.name.includes("mod") ||
                        channel.name.includes("WTCW") ||
                        channel.name.includes("WT-CW")
                    )
                );
                targetChannel = securityChannels.first() || null;
            }

            if (!targetChannel) {
                console.warn("Nebylo nalezeno žádné vhodné místo pro oznámení banu.");
                return;
            }

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
        console.log(`${this.lang.BannedIP}${ipAddress}`);
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
                    flags: 64
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
            this.bannedDiscordUsers = new Set(JSON.parse(data));
        } catch {
            this.bannedDiscordUsers = new Set();
        }
    }

    /**
     * Save banned Discord users to storage
     */
    async saveBannedDiscordUsers() {
        try {
            await fs.writeFile(this.discordBanListPath, this.safeStringify([...this.bannedDiscordUsers], null, 2));
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
            this.bannedDevices = new Set(JSON.parse(data));
        } catch {
            this.bannedDevices = new Set();
        }
    }

    /**
     * Save banned devices
     */
    async saveBannedDevices() {
        try {
            await fs.writeFile(this.banListPath, this.safeStringify([...this.bannedDevices], null, 2));
        } catch (error) {
            console.error(this.lang.ErrorSavingDev, error);
        }
    }

    /**
     * Deep sanitization (existing functionality)
     */
    deepSanitize(obj) {
        if (typeof obj === 'string') return this.sanitizeString(obj);
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(item => this.deepSanitize(item));
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (key.startsWith('$') && !this.isLegitimateOperator(key, value, obj)) {
                    continue;
                }
                sanitized[this.sanitizeString(key)] = this.deepSanitize(value);
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
        let sanitized = validator.escape(str);
        sanitized = sanitized.replace(/\$(?![0-9])/g, '&#36;');
        return sanitized;
    }

    /**
     * Check operator legitimacy
     */
    isLegitimateOperator(operator, value) {
        if (this.dangerousOperators.includes(operator)) return false;
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
        if (JSON.stringify(original) !== JSON.stringify(sanitized)) {
            threatLevel += 1;
        }
        const origStr = typeof original === 'string' ? original : JSON.stringify(original);
        this.suspiciousPatterns.forEach(pattern => {
            if (pattern.test(origStr)) threatLevel += 2;
        });
        this.dangerousOperators.forEach(op => {
            if (origStr.includes(op)) threatLevel += 3;
        });
        const injectionIndicators = (origStr.match(/\$[a-zA-Z]+/g) || []).length;
        if (injectionIndicators > 3) threatLevel += 5;
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
                if (seen.has(value)) return '[Circular]';
                seen.add(value);
            }
            if (typeof value === 'bigint') return value.toString();
            if (typeof value === 'symbol') return value.description || value.toString();
            if (typeof value === 'function') return `[Function${value.name ? ': ' + value.name : ''}]`;
            if (typeof value === 'undefined') return '[undefined]';
            if (value instanceof Date) return value.toISOString();
            if (value instanceof RegExp) return value.toString();
            return value;
        }, 2);
    }

}

export default SecurityManager;