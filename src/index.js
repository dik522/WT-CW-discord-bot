import { EventEmitter } from 'node:events';
import dotenv from "dotenv";
dotenv.config();
import { Client, IntentsBitField, Integration, MessageType, MessageManager, EmbedBuilder, MessageFlags, ModalBuilder} from 'discord.js';
import axios from 'axios';
import cheerio from 'cheerio';
import {MongoClient} from 'mongodb';
const klient = new MongoClient(process.env.URI);
import AsciiTable from 'ascii-table';
import fs from "fs";
import { setTimeout } from "timers";
import {promises as fsPromise} from "fs";
const client = new Client ({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates
    ],
});
client.setMaxListeners(15);
export {client};
import {tomorowsDate, actualDate, todaysbr} from "./moduly/obecne_fce.mjs";
import {DayActivity, squadronPoints, brRangeTable, membersPoints, MemberCheck, passwordCheck, clearenceChech, ProfileIniciation, SeasonSummary} from "./moduly/svazove_fce.mjs";
import SecurityManager from "./security/security_manager.js";


let securityManager;


//global variables
let season = [];
let language = {};
let configuration
let IDDb = [];
let relations=[];
let actualbr;
let passwords = [];
//functions to properly inicialise bot
/**
 * Loads configuration
 */
async function loadConfig() {
    try {
        const json = await fsPromise.readFile("configuration.json", "utf8");
        configuration = JSON.parse(json);
        passwords = configuration.administrators
        console.log("Configuration loaded succesfully")
    } catch (err) {
        console.log("Configuration loading error: ", err);
    }
}
/**Loads language dataset specified in configuration
 * 
 */
async function loadLanguage(){
    try{
        const json = await fsPromise.readFile("languages/"+ configuration.language +".json", "utf8");
        language = JSON.parse(json);
        console.log(language.BotInicialization.LanguageLoadSuccess)
    }catch(err){
        console.log(LanguageLoadError, err);
    }
}
/**
 * Loads season data
 * @param {object} configuration - configuration object
 * @param {object} language - language dataset
 */
async function loadSeason(configuration, language) { 
    try {
        const json = await fsPromise.readFile("season.json", "utf8");
        season = JSON.parse(json);
        console.log(language.BotInicialization.SeasonLoadSuccess);
        actualbr = todaysbr(season);
        client.channels.fetch(configuration.administrationChannel)
            .then(channel=>{
                channel.send(language.BotInicialization.SeasonLoadSuccess + 
                    `\n ${JSON.stringify(season[0])}\n ${JSON.stringify(season[1])}\n ${JSON.stringify(season[2])}\n ${JSON.stringify(season[3])}\n ${JSON.stringify(season[4])}\n ${JSON.stringify(season[5])}\n ${JSON.stringify(season[6])}\n ${JSON.stringify(season[7])}\n ${JSON.stringify(season[8])}`
                );
            })
            .catch(error => console.log(language.BotInicialization.SeasonLoadError,error));
    } catch (err) {
        if (err.code === "ENOENT") {
            client.channels.fetch(configuration.administrationChannel)
                .then(channel=>{
                    channel.send(language.BotInicialization.SeasonLoadNotExists)
                })
                .catch(error => console.log(language.BotInicialization.SeasonLoadError,error));
            season = [ {value: null, interval:[undefined, undefined]}, {value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]},{value: null, interval:[undefined, undefined]}];
            let json = JSON.stringify(season);
            fs.writeFile('season.json', json, 'utf8', function (err) {
                if (err) {
                    console.log("Error while creating season file: ", err);
                }
            })
        } else {
            console.log(language.BotInicialization.SeasonLoadError, err);
        }
    }
}
/**
 * Connects to Mongodb
 */
async function DBConnection() {
    try{
        await klient.connect();
        console.log(language.BotInicialization.dbConnectSuccess);
    }catch(error){
        console.log(language.BotInicialization.dbConnectError, error)
    }
}
async function BotInicialization() {
    console.log("-------------------", actualDate())
    await loadConfig();
    await loadLanguage();
    await client.login(process.env.TOKEN);
    securityManager = new SecurityManager({
        logPath: './src/security/security.log',
        banListPath: './src/security/banned_devices.json',
        discordBanListPath: './src/security/banned_discord_users.json',
        discordClient: client,
        securityChannel: configuration.administrationChannel,
        guildIds: [process.env.GUILD_ID],
        languageDataset: language.Security
    });
    await loadSeason(configuration,language);
    await DBConnection();
    client.channels.fetch(configuration.administrationChannel)
            .then(channel=>{
                channel.send(language.BotInicialization.Finished);
            })
    timer(configuration.activation.hours,configuration.activation.minutes,configuration.activation.seconds, [
        async () => membersPoints(actualbr, configuration.firstClan, actualDate(),configuration, language),
        async () => membersPoints(actualbr, configuration.secondClan, actualDate(),configuration, language),
        async () => membersPoints(actualbr, configuration.thirdClan, actualDate(),configuration, language),
        async () => membersPoints(actualbr, configuration.fourthClan, actualDate(),configuration, language),
        async () => DayActivity(configuration, language),
        async () => squadronPoints(configuration.firstClan, language),
        async () => squadronPoints(configuration.secondClan, language),
        async () => squadronPoints(configuration.thirdClan, language),
        async () => squadronPoints(configuration.fourthClan, language),
        async () => brRangeTable(season, configuration, language),
        async () => MemberCheck(process.env.GUILD_ID, configuration, language),
        async () => SeasonSummary (configuration, language, season),
        () => reset(),
        () => console.log("---------------------------------------", actualDate())
    ]);
}
//general functions

/**
 * Activates (calls) a function on specified time
 * @param {number} hour - hour in 24h format, UCT time
 * @param {number} minutes  - minutes
 * @param {number} seconds - seconds
 * @param {function} callback - function to be called
 */
function timer(hour, minutes, seconds, callbacks) {
    const now = new Date();
    let plannedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, seconds);
    let timeDifference = plannedTime - now;

    if (timeDifference <= 0) {
        plannedTime.setDate(plannedTime.getDate() + 1);
        timeDifference = plannedTime - now;
    }
    setTimeout(async () => {
        for (const cb of callbacks) {
            if (typeof cb === 'function') {
                await cb();
            }
        }
        timer(hour, minutes, seconds, callbacks);
    }, timeDifference);
}
/**
 * function reseting some data
 */
let reset = function(){
    relations =[];
    IDDb = [];
    actualbr = todaysbr(season);
}
/** Storing season's brs
 * Does store every br in current season
 * Provide the HIGHEST br of every br range in current season
 */
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'season-br') {
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const input = {
            br1: interaction.options.get("br1").value,
            br2: interaction.options.get("br2").value,
            br3: interaction.options.get("br3").value,
            br4: interaction.options.get("br4").value,
            br5: interaction.options.get("br5").value,
            br6: interaction.options.get("br6").value,
            br7: interaction.options.get("br7").value,
            br8: interaction.options.get("br8").value,
            br9: interaction.options.get("season_end").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id,
        };
        const sanitizedInput = await securityManager.sanitizeInput(input, {interaction: interaction});
        const br1 = sanitizedInput.br1;
        const br2 = sanitizedInput.br2;
        const br3 = sanitizedInput.br3;
        const br4 = sanitizedInput.br4;
        const br5 = sanitizedInput.br5;
        const br6 = sanitizedInput.br6;
        const br7 = sanitizedInput.br7;
        const br8 = sanitizedInput.br8;
        const br9 = sanitizedInput.br9;

        season[0].value = br1;
        season[1].value = br2;
        season[2].value = br3;
        season[3].value = br4;
        season[4].value = br5;
        season[5].value = br6;
        season[6].value = br7;
        season[7].value = br8;
        season[8].value = br9;
        actualbr = todaysbr(season);
        
        const json = JSON.stringify(season);
        fs.writeFile('season.json', json, 'utf8', function (err) {
            if (err) {
                console.log(language.CWSeason.BR.SaveError, err);
                interaction.reply({content:language.CWSeason.BR.SaveError, flags: MessageFlags.Ephemeral})
            } else {
                console.log(language.CWSeason.BR.SaveSuccess, json);
                interaction.reply({content:language.CWSeason.BR.SaveSuccess, flags: MessageFlags.Ephemeral})
            }
        })
    }
})
/**Storing season's dates
 * Does store dates in which br of CW in current season will be changed
 */
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'season_dates') {
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const input = {
            season_start: interaction.options.get("season_start").value,
            date1: interaction.options.get("date1").value,
            date2: interaction.options.get("date2").value,
            date3: interaction.options.get("date3").value,
            date4: interaction.options.get("date4").value,
            date5: interaction.options.get("date5").value,
            date6: interaction.options.get("date6").value,
            date7: interaction.options.get("date7").value,
            date8: interaction.options.get("date8").value,
            season_end: interaction.options.get("season_end").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        };
        const sanitizedInput = await securityManager.sanitizeInput(input, {interaction: interaction});
        const season_start = sanitizedInput.season_start;
        const date1 = sanitizedInput.date1;
        const date2 = sanitizedInput.date2;
        const date3 = sanitizedInput.date3;
        const date4 = sanitizedInput.date4;
        const date5 = sanitizedInput.date5;
        const date6 = sanitizedInput.date6;
        const date7 = sanitizedInput.date7;
        const date8 = sanitizedInput.date8;
        const season_end = sanitizedInput.season_end;

        season[0].interval = [season_start, date1];
        season[1].interval = [date1, date2];
        season[2].interval = [date2, date3];
        season[3].interval = [date3, date4];
        season[4].interval = [date4, date5];
        season[5].interval = [date5, date6];
        season[6].interval = [date6, date7];
        season[7].interval = [date7, date8];
        season[8].interval = [date8, season_end];
        actualbr = todaysbr(season);

        const json = JSON.stringify(season);
        fs.writeFile('season.json', json, 'utf8', function (err) {
            if (err) {
                console.log(language.CWSeason.Dates.SaveError, err);
                interaction.reply({content:language.CWSeason.Dates.SaveError, flags: MessageFlags.Ephemeral})
            } else {
                console.log(language.CWSeason.Dates.SaveSuccess, json);
                interaction.reply({content:language.CWSeason.Dates.SaveSuccess, flags: MessageFlags.Ephemeral})
            }
        })
    }
})
/**Scraping web for current information of given squadron
 * Scrapes web to get statistics of clan and sends them into given discord chat user by user
 */
client.on('messageCreate',async (messages)=> {
    if((messages.content === "scrape:1" && configuration.firstClan.used) || (messages.content ==="scrape:2" && configuration.secondClan.used) || (messages.content ==="scrape:3" && configuration.thirdClan.used) || (messages.content === "scrape:4" && configuration.fourthClan.used)){ {
        const sanitizedMessage = await securityManager.sanitizeInput(messages.content, {messages: messages, author: messages.author});
        let messageContent = sanitizedMessage.split(":");
        let channel;
        let url;
        let OF;
        if (messageContent[1] ==="1") {
            channel = configuration.firstClan.scrapeChannel;
            url = configuration.firstClan.URL;
            OF = configuration.firstClan.scrapeOF;
        } else if (messageContent[1] ==="2") {
            channel = configuration.secondClan.scrapeChannel;
            url = configuration.secondClan.URL;
            OF = configuration.secondClan.scrapeOF;
        } else if (messageContent[1] ==="3") {
            channel = configuration.thirdClan.scrapeChannel;
            url = configuration.thirdClan.URL;
            OF = configuration.thirdClan.scrapeOF;
        } else if (messageContent[1] ==="4") {
            channel = configuration.fourthClan.scrapeChannel;
            url = configuration.fourthClan.URL;
            OF = configuration.fourthClan.scrapeOF;
        }
    if(!OF) return
    client.channels.fetch(channel)
        .then(channel => {
            channel.send(language.scrapeProccesing)
        .catch(console.error);
        });
        axios.get(url)
            .then(async response => {
                const html = response.data;
                const $ = cheerio.load(html);
                const sqmembers = [];
                $('.squadrons-members__grid-item').each(function(){
                    let pole = $(this).text().trim();
                    sqmembers.push(pole)
                })
                let sleep = async (ms) => await new Promise(r => setTimeout(r,ms));
                let number = sqmembers.length
                let i = 7;
                let message;
                let structuredArray=[];
                while(i<=number){
                    let memberName = sqmembers[i].replace(/([_\-~*])/g, '\\$1');
                    structuredArray.push({clen: memberName,CWbody: sqmembers[i+1], aktivita: sqmembers[i+2],role: sqmembers[i+3],date: sqmembers[i+4]})
                    i= i+6
                }
                structuredArray.sort((a, b) => {
                    const param1 = a.clen.toUpperCase()
                    const param2 = b.clen.toUpperCase()
                    if(param1 < param2) return -1
                    if(param1 > param2) return 1
                    return 0
                })
                let o = 0;
                const pocet = structuredArray.length
                while(o<= pocet){
                    await sleep(1000)
                    let cast
                    const member = structuredArray[o].clen;
                    const CWpoints = structuredArray[o].CWbody;
                    const activity = structuredArray[o].aktivita;
                    const role = structuredArray[o].role;
                    const date = structuredArray[o].date;
                    cast = `${language.Misc.Player}: **${member}** \n ${language.Misc.CWpoints}: ${CWpoints} \n ${language.Misc.Activity}: ${activity} \n ${language.Misc.Role}: ${role} \n ${language.Misc.Arrival}: ${date}`
                    o = o+1;
                    message = cast
                    client.channels.fetch(channel)
                        .then(channel => {
                            channel.send(message)
                        .catch(console.error);
                        });
                };
            })
            .catch(console.error)
    }
}})
/**Change configuration of the bot
 * 
 */
client.on("interactionCreate", async (interaction)=>{
    try{
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === "configuration_change"){
                const secure = await securityManager.checkDiscordSecurity(interaction);
                if(!secure){
                    console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
                    return
                }
                const Input = {
                    functionOF: interaction.options.get("switch_function")?.value,
                    OF: interaction.options.get("switch_on_off")?.value,
                    channel: interaction.options.get("function_channel")?.value,
                    ID: interaction.options.get("channel_id")?.value,
                    password: interaction.options.get("password").value,
                    clan: interaction.options.get("clan").value,
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                };
                const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: interaction});
                const functionOF = sanitizedInput.functionOF;
                const OF = sanitizedInput.OF;
                const channel = sanitizedInput.channel;
                const ID = sanitizedInput.ID;
                const password = sanitizedInput.password;
                const clan = sanitizedInput.clan;
                let passwordRight = await passwordCheck(password, passwords);
                if(!passwordRight.success){
                    interaction.reply({content:language.Configuration.WrongPassword,ephemeral: true})
                    client.channels.fetch(configuration.administrationChannel)
                        .then(channel =>{
                            channel.send(`${language.Configuration.ChangeAttempt} <@${interaction.user.id}>`)
                        })
                }else{
                    const user = passwordRight.user
                    if((functionOF && typeof(OF)!= "undefined")||(typeof(channel) == "string" &&ID )){
                        if(typeof(functionOF)!="undefined"){
                            if(svaz == "1"){
                                console.log(passwordRight);
                                const clearenceGivven = await clearenceChech(user, ["1", "high"])
                                if(!clearenceGivven.success){
                                    interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                    console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                    client.channels.fetch(configuration.administrationChannel)
                                        .then(channel =>{
                                            channel.send(`${language.Configuration.OFChangeAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                        })
                                    return
                                }
                                configuration.firstClan[functionOF] = OF
                            }else if (svaz == "2"){
                                const clearenceGivven = await clearenceChech(user, ["2", "high"])
                                if(!clearenceGivven.success){
                                    interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                    console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                    client.channels.fetch(configuration.administrationChannel)
                                        .then(channel =>{
                                            channel.send(`${language.Configuration.OFChangeAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                        })
                                    return
                                }
                                configuration.secondClan[functionOF] = OF
                            }else if (svaz == "3"){
                                const clearenceGivven = await clearenceChech(user, ["3", "high"])
                                if(!clearenceGivven.success){
                                    interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                    console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                    client.channels.fetch(configuration.administrationChannel)
                                        .then(channel =>{
                                            channel.send(`${language.Configuration.OFChangeAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                        })
                                    return
                                }
                                configuration.thirdClan[functionOF] = OF
                            }else{
                                const clearenceGivven = await clearenceChech(user, ["4", "high"])
                                if(!clearenceGivven.success){
                                    interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                    console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                    client.channels.fetch(configuration.administrationChannel)
                                        .then(channel =>{
                                            channel.send(`${language.Configuration.OFChangeAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                        })
                                    return
                                }
                                configuration.fourthClan[functionOF] = OF
                            }
                        }if(typeof(channel)!="undefined"){
                            if(channel == "administrationChannel"){
                                const clearenceGivven = await clearenceChech(user, ["developer"])
                                if(clearenceGivven.success){
                                    configuration.administrationChannel = ID
                                }else{
                                    interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true})
                                    console.log(language.Configuration.consoleAdminChannelChangeAttempt, interaction.user.username, user.holder);
                                    return
                                    }
                            }else{
                                if(svaz == "1"){
                                    const clearenceGivven = await clearenceChech(user, ["1", "high"])
                                    if(!clearenceGivven.success){
                                        interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                        console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                        client.channels.fetch(configuration.administrationChannel)
                                            .then(channel =>{
                                                channel.send(`${language.Configuration.consoleWrongClanAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                            })
                                        return
                                    }
                                    configuration.firstClan[channel] = ID
                                }else if(svaz == "2"){
                                    const clearenceGivven = await clearenceChech(user, ["2", "high"])
                                    if(!clearenceGivven.success){
                                        interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                        console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                        client.channels.fetch(configuration.administrationChannel)
                                            .then(channel =>{
                                                channel.send(`${language.Configuration.consoleWrongClanAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                            })
                                        return
                                    }
                                    configuration.secondClan[channel] = ID
                                }else if(svaz == "3"){
                                    const clearenceGivven = await clearenceChech(user, ["3", "high"])
                                    if(!clearenceGivven.success){
                                        interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                        console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                        client.channels.fetch(configuration.administrationChannel)
                                            .then(channel =>{
                                                channel.send(`${language.Configuration.consoleWrongClanAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                            })
                                        return
                                    }
                                    configuration.thirdClan[channel] = ID
                                }else{
                                    const clearenceGivven = await clearenceChech(user, ["4", "high"])
                                    if(!clearenceGivven.success){
                                        interaction.reply({content:language.Configuration.Unprivileged, ephemeral: true});
                                        console.log(language.Configuration.consoleWrongClanAttempt, interaction.user.username, password);
                                        client.channels.fetch(configuration.administrationChannel)
                                            .then(channel =>{
                                                channel.send(`${language.Configuration.consoleWrongClanAttempt} <@${interaction.user.id}>; ${user.holder}`)
                                            })
                                        return
                                    }
                                    configuration.fourthClan[channel] = ID
                                }
                            }
                        }
                        let json = JSON.stringify(configuration)
                        fs.writeFile("configuration.json", json, "utf8", function (err){
                            if (err){
                                console.log(language.Configuration.ChangeError, err);
                                interaction.reply({content:language.Configuration.Error, flags: MessageFlags.Ephemeral})
                            }else{
                                console.log(language.Configuration.SuccessConsole, interaction.user.username, configuration);
                                interaction.reply({content:language.Configuration.Success, flags: MessageFlags.Ephemeral})
                            }
                        })
                    }else{
                        interaction.reply({content:language.Configuration.WrongChoise, flags: MessageFlags.Ephemeral})
                    }
                }
            }
    }catch (error){
        interaction.reply({content:language.Configuration.ChangeError, flags: MessageFlags.Ephemeral})
        console.error(language.Configuration.ErrorConsole, error);
    }
})
/**Inicialization of member's profile
 * Does initialize DB profile of new clan member
 */
client.on("interactionCreate", async (interaction)=>{
    if(!interaction.isChatInputCommand()) return
    if(interaction.commandName === "init_profile"){
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const Input = {
            nickwt: interaction.options.get("nickwt").value,
            discordid: interaction.options.get("discordid").value,
            squadron: interaction.options.get("squadron").value,
            comments: interaction.options.get("comments").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        }
        const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: interaction});
        const WTNick = sanitizedInput.nickwt;
        const IDDsc = sanitizedInput.discordid;
        const squadron = sanitizedInput.squadron;
        const comments = sanitizedInput.comments;
        ProfileIniciation(WTNick, IDDsc, squadron, comments, actualDate(), language, configuration)
        interaction.reply({content:language.Profile.Created, ephemeral: true})
    }
})
//adding yourself as a logger
client.on("interactionCreate", async (interaction)=>{
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName === "evidence"){
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const editor = await securityManager.sanitizeInput(interaction.options.get("user").value, {interaction: interaction});
        const member = interaction.user.username;
        const memberID = interaction.user.id;
        let logger = relations.find(memb => memb.memb === editor)
        client.channels.fetch(logger.channel)
            .then(channel=>{
                channel.messages.fetch(ID)
                    .then(message =>{
                        let obsah = message.content;
                        let poradnik = obsah.split(";")
                        let prozatimni = poradnik.pop()
                        poradnik.push(`<@${memberID}>`)
                        let poradnik2 = poradnik.join(",")
                        poradnik = [poradnik2]
                        poradnik.push(prozatimni)
                        obsah = poradnik.join(";")
                        message.edit(obsah)
                        relations.push({memb: member, channel: logger.channel, IDZprava: logger.IDZprava, index: logger.index})
                    })
            })
        interaction.reply({content:language.CWResults.EditorAdded, flags: MessageFlags.Ephemeral})
}})


//              slash commands
/**CW entry
 * Provides new entry of clan wars result
 */
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "cw_entry") {
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const Input = {
            result: interaction.options.get("result").value,
            squadron: interaction.options.get("squadron").value,
            planes: interaction.options.get("planes").value,
            helicopters: interaction.options.get("helicopters").value,
            aa: interaction.options.get("aa").value,
            reprezentative: interaction.options.get("reprezentative").value,
            comments: interaction.options.get("comments")?.value,
            tanks: interaction.options.get("tanks").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        };
        const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: interaction});
        const result = sanitizedInput.result;
        const squadron = sanitizedInput.squadron;
        const planes = sanitizedInput.planes;
        const helicopters = sanitizedInput.helicopters;
        const aa = sanitizedInput.aa;
        const reprezentative = sanitizedInput.reprezentative;
        const comments = sanitizedInput.comments;
        const tanks = sanitizedInput.tanks;
        let sum;
        sum = planes+helicopters;
        sum += aa;
        sum += tanks;
        if (sum!==8) {
            interaction.reply({content:language.CWResults.MathError, ephemeral: true});
            return
        }

        let editor = relations.find(editor => editor.editor === interaction.user.username)
        let channel
        if(editor == undefined){
            if(interaction.member.roles.cache.has(configuration.firstClan.RoleID) && configuration.firstClan.used && configuration.firstClan.CWEntryOF){channel = configuration.firstClan.CWEntryChannel}
            else if(interaction.member.roles.cache.has(configuration.secondClan.RoleID) && configuration.secondClan.used && configuration.secondClan.CWEntryOF){channel = configuration.secondClan.CWEntryChannel}
            else if(interaction.member.roles.cache.has(configuration.thirdClan.RoleID) && configuration.thirdClan.used && configuration.thirdClan.CWEntryOF){channel = configuration.thirdClan.CWEntryChannel}
            else if(interaction.member.roles.cache.has(configuration.fourthClan.RoleID) && configuration.fourthClan.used && configuration.fourthClan.CWEntryOF){channel = configuration.fourthClan.CWEntryChannel}
         }
        else{
            channel = editor.channel
        }
        if(editor !== undefined){
            //adding result into already existing message
            client.channels.fetch(channel)
                .then(channel =>{
                    const messageID = editor.messageID
                    channel.messages.fetch(messageID)
                    .then(async message=>{
                        //code which adds new result into message withouth breaking it
                        let obsah = message.content
                        obsah = obsah.split('\n');
                        obsah.pop()
                        obsah = obsah.join('\n')
                        obsah = obsah + `\n${result} ${language.Misc.Squadron}: ${squadron}, ${language.Misc.Planes}: ${planes}, ${language.Misc.Helicopters}: ${helicopters}, ${language.Misc.AA}: ${aa}, ${language.Misc.Reprezentative}: ${reprezentative}, ${comments}\n\`\`\` `
                        message.edit(obsah)
                        let obsah2 = {
                            [language.Misc.Result]:result,
                            [language.Misc.Squadron]:squadron,
                            [language.Misc.Planes]:planes,
                            [language.Misc.Helicopters]: helicopters,
                            [language.Misc.AA]: aa,
                            [language.Misc.Comments]: comments,
                            br: actualbr}
                        if(reprezentative){
                            let bordel = await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).insertOne(obsah2)
                            IDDb[editor.index].push(bordel.insertedId.toHexString())
                            interaction.reply({content: language.CWResults.Entry.Success, ephemeral: true});
                        }
                })
                })
        }else{
            //creating new message for results
            let bordel
            client.channels.fetch(channel)
                .then(async channel =>{
                    let obsah2 = {
                            [language.Misc.Result]:result,
                            [language.Misc.Squadron]:squadron,
                            [language.Misc.Planes]:planes,
                            [language.Misc.Helicopters]: helicopters,
                            [language.Misc.AA]: aa,
                            [language.Misc.Comments]: comments,
                            br: actualbr}
                    if(reprezentative) {bordel = await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).insertOne(obsah2)}
                    channel.send(`${language.CWResults.Entry.SuccessEditor}<@${interaction.user.id}>; \`\`\`diff\n${result} ${language.Misc.Squadron}: ${squadron}, ${language.Misc.Planes}: ${planes}, ${language.Misc.Helicopters}: ${helicopters}, ${language.Misc.AA}: ${aa}, ${language.Misc.Reprezentative}: ${reprezentative}, ${comments}\n\`\`\` `)
                        .then(message =>{
                            let index
                            if(reprezentative){index = IDDb.push([bordel.insertedId.toHexString()]) - 1}else{index = IDDb.push([])-1}
                            relations.push({editor: interaction.user.username, channel: channel.id, messageID: message.id, index: index})
                        })
                            
        })
        interaction.reply({content: language.CWResults.Entry.Success, ephemeral: true});        
    }
}})
/**Editing of CW entry
 * Edits last entry of clan wars result
 */
client.on("interactionCreate", async (interaction) =>{
    if (!interaction.isChatInputCommand()) return;
    if(interaction.commandName ==="cw_edit"){
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const Input = {
            result: interaction.options.get("result").value,
            squadron: interaction.options.get("squadron").value,
            planes: interaction.options.get("planes").value,
            helicopters: interaction.options.get("helicopters").value,
            aa: interaction.options.get("aa").value,
            reprezentative: interaction.options.get("reprezentative").value,
            comments: interaction.options.get("comments")?.value,
            tanks: interaction.options.get("tanks").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        }
        const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: interaction});
        const result = sanitizedInput.result;
        const squadron = sanitizedInput.squadron;
        const planes = sanitizedInput.planes;
        const helicopters = sanitizedInput.helicopters;
        const aa = sanitizedInput.aa;
        const reprezentative = sanitizedInput.reprezentative;
        const comments = sanitizedInput.comments;
        const tanks = sanitizedInput.tanks;
        let sum;
        sum = planes+helicopters;
        sum += aa;
        sum += tanks;
        if (sum!==8) {
            interaction.reply({content:language.CWResults.MathError, ephemeral: true});
            return
        }
        let editor = relations.find(editor => editor.editor === interaction.user.username)
        if(editor == undefined){
        
            interaction.reply({content:language.CWResults.Edit.NonEditor, flags: MessageFlags.Ephemeral})
        }
        interaction.reply({content:language.CWResults.Edit.Success, flags: MessageFlags.Ephemeral})
        client.channels.fetch(editor.channel) 
            .then(channel =>{
                channel.messages.fetch(editor.messageID)
                    .then(async message =>{
                        let obsah = message.content
                        obsah = obsah.split('\n');
                        obsah.pop()
                        let obsah2 = obsah.pop()
                        obsah2 = obsah2.split(",")
                        obsah2.pop()
                        let obsah3 = obsah2.pop()
                        obsah3 = obsah3.split(":")
                        let obsah4 = obsah3.pop()
                        obsah4.trim()
                        obsah = obsah.join('\n')
                        obsah = obsah + `\n${result} ${language.Misc.Squadron}: ${squadron}, ${language.Misc.Planes}: ${planes}, ${language.Misc.Helicopters}: ${helicopters}, ${language.Misc.AA}: ${aa}, ${language.Misc.Reprezentative}: ${reprezentative}, ${comments}\n\`\`\` `
                        message.edit(obsah)
                        let bordel
                        if(reprezentative == true){
                            if(obsah4 == true){
                                let vkladane = {[language.Misc.Result]:result,
                            [language.Misc.Squadron]:squadron,
                            [language.Misc.Planes]:planes,
                            [language.Misc.Helicopters]: helicopters,
                            [language.Misc.AA]: aa,
                            [language.Misc.Comments]: comments,
                            br: actualbr}
                                bordel = await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).updateOne({_id:IDDb[editor.index].at(-1)}, {$set: vkladane}, {upsert:true})
                            } else{
                                let vkladane = {[language.Misc.Result]:result,
                            [language.Misc.Squadron]:squadron,
                            [language.Misc.Planes]:planes,
                            [language.Misc.Helicopters]: helicopters,
                            [language.Misc.AA]: aa,
                            [language.Misc.Comments]: comments,
                            br: actualbr}
                                bordel = await klient.db(configuration.DBNames.DB).collection(configuration.DBNames.Collection).insertOne(vkladane)
                                IDDb[editor.index].push(bordel.insertedId.toHexString())
                            }
                        }else if(obsah4 == true){
                            await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).deleteOne(IDDb[editor.index].pop())
                        }
                    })
            })
    }
})
/**Deleting of CW entry
 * Deletes last entry of clan wars result
 */
client.on("interactionCreate", async (interaction) =>{
    if (!interaction.isChatInputCommand()) return;
    if(interaction.commandName ==="cw_delete"){
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        let editor = relations.find(editor => editor.editor === interaction.user.username)
        if(pravelogger == undefined){
            interaction.reply({content:language.CWResults.Delete.NonEditor, flags: MessageFlags.Ephemeral})
        }
        client.channels.fetch(editor.channel)
            .then(channel =>{
                channel.messages.fetch(editor.messageID)
                    .then(async message =>{
                        let obsah = message.content
                        obsah = obsah.split('\n');
                        obsah.pop()
                        let obsah2 = obsah.pop()
                        obsah = obsah.join('\n')
                        obsah =obsah + `\n\`\`\` `
                        message.edit(obsah)//checks if the deleted message is reprezentative and deletes it
                        obsah2 =obsah2.split(",")
                        obsah2.pop()
                        let obsah3 = obsah2.pop()
                        obsah3 = obsah3.split(":")
                        let obsah4 = obsah3.pop()
                        obsah4.trim()
                        let bordel
                        if (obsah4==true){bordel = await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).deleteOne(IDDb[editor.index].pop())}
                        interaction.reply({content:language.CWResults.Delete.Success, flags: MessageFlags.Ephemeral})
                })
            })
    }
})
/**Showing members profile
 * 
*/
client.on("interactionCreate", async (interaction) =>{
    if(!interaction.isChatInputCommand())return;
    if(interaction.commandName === "view_profile"){
        await interaction.deferReply({ ephemeral: true });//        swrgsdhbsdndfhmnxfhnf
        console.log(866)//                                          agbsgnhdrndfhnmzfdnfnz
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        console.log(872)//                                          sgrbvfsdbdebdgbdgbdgb
        const Input = {
            password: interaction.options.get("password").value,
            member: interaction.options.get("member").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        }
        console.log(879)//                                          dbdskbvfsljabvhslibvhzs
        const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: interaction});
        const password = sanitizedInput.password;
        const member = sanitizedInput.member;
        try{
            console.log(884)//                                          agbsgnhdrndfhnmzfdnfnz
            let passwordRight = await passwordCheck(password, passwords);
            if(!passwordRight.success) return
            console.log(887)//                                          agbsgnhdrndfhnmzfdnfnz
            let resultReceived = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({nick_WT: member}).toArray();
            console.log(889)//                                          agbsgnhdrndfhnmzfdnfnz
            let result = resultReceived[0];
            if (!result) {
                await interaction.reply({ content: "Uživatel nenalezen.", ephemeral: true });
                return;
            }
            console.log(895)//                                          agbsgnhdrndfhnmzfdnfnz
            let ForgivenLim;
            if(typeof(result.forgiveLimit) === "undefined"){ForgivenLim = "false"}else{ForgivenLim = result.forgiveLimit};
            console.log(898)//                                          agbsgnhdrndfhnmzfdnfnz
            let zprava = new EmbedBuilder()
                .setTitle(language.EmbedTitle)
                .setDescription(language.EmbdedDescription)
                .setColor("08e79f")
                .addFields(
                    {name: language.Misc.Player, value: result.nick_WT},
                    {name: "Discord", value: result.IDDiscord},
                    {name: language.Misc.Arrival, value: result.joinDate},
                    {name: language.Misc.Squadron, value: result.clan},
                    {name: language.Misc.InClan, value: result.inClan},
                    {name: language.Misc.PointsLimit, value: result.acomplishedLimit},
                    {name: language.Misc.Comments, value: result.comments},
                    {name: language.Misc.ForgivenLim, value: ForgivenLim},
                    {name: language.Misc.secondaryAccount, value: result.ignoreAbsence},
                    {name: language.Misc.CWPoints, value: result.records?.at(-1)?.CWpoints ?? "N/A", inline: true},
                    {name: language.Misc.Activity, value: result.records?.at(-1)?.activity ?? "N/A", inline: true},
                    {name: language.Misc.Date, value: result.records?.at(-1)?.date ?? "N/A", inline: true}
                )
            console.log(917)//                                          agbsgnhdrndfhnmzfdnfnz
            let EditBtn = new ButtonBuilder()
                .setLabel(language.EditBtnLabel)
                .setStyle(ButtonStyle.Primary)
                .setCustomId("EditMembersProfile")
            let ForgivenLimitBtn = new ButtonBuilder()
                .setLabel(language.Profile.BtnForgiveLimit)
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("ForgiveLimit")
            console.log(925)//                                          agbsgnhdrndfhnmzfdnfnz
            const buttonRow = new ActionRowBuilder().addComponents([EditBtn, ForgivenLimitBtn]);
            console.log(928)//                                          agbsgnhdrndfhnmzfdnfnz
            const reply = await interaction.reply({embeds: [zprava], components: [buttonRow], ephemeral: true});
            console.log(language.ProfileView)

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120_000
            });
            console.log(936)//                                          agbsgnhdrndfhnmzfdnfnz
            collector.on("collect", async (interaction) =>{
                if(interaction.customId === "EditMembersProfile"){
                    const modal = new ModalBuilder({
                        customId: "EditProfileModal",
                        title: language.Profile.EditModalTitle,
                    })
                    console.log(943)//                                  agbsgnhdrndfhnmzfdnfnz
                    const nick_WT_Modal = new TextInputBuilder({
                        customId: "nick_WT_Modal",
                        label: language.Profile.EditModalNickWT,
                        style:TextInputStyle.Short,
                        required: false,
                        placeholder: result.nick_WT
                    })
                    const IDDiscord_Modal = new TextInputBuilder({
                        customId: "IDDiscord_Modal",
                        label: language.Profile.EditModalIDDsc,
                        style: TextInputStyle.Short,
                        required: false,
                        placeholder: result.IDDiscord
                    })
                    const inClan_Modal = new TextInputBuilder({
                        customId: "inClan_Modal",
                        label: language.Profile.EditModalInClan,
                        style: TextInputStyle.Short,
                        required: false,
                        placeholder: result.inClan
                    })
                    const clan_Modal = new TextInputBuilder({
                        customId: "clan_Modal",
                        label: language.Profile.EditModalClan,
                        style: TextInputStyle.Short,
                        required: false,
                        placeholder: result.clan
                    })
                    const secondaryAccount_Modal = new TextInputBuilder({
                        customId: "secondaryAccount_Modal",
                        label: language.Profile.EditModalSecondary,
                        style: TextInputStyle.Short, //Paragraph
                        required: false,
                        placeholder: result.ignoreAbsence
                    })
                    console.log(979)//                                          agbsgnhdrndfhnmzfdnfnz
                    const nick_WT_Row = new ActionRowBuilder().addComponents(nick_WT_Modal);
                    const IDDiscord_Row = new ActionRowBuilder().addComponents(IDDiscord_Modal);
                    const inClan_Row = new ActionRowBuilder().addComponents(inClan_Modal);
                    const clan_Row = new ActionRowBuilder().addComponents(clan_Modal);
                    const secondaryAccount_Row = new ActionRowBuilder().addComponents(secondaryAccount_Modal);

                    modal.addComponents(nick_WT_Row, IDDiscord_Row, inClan_Row, clan_Row, secondaryAccount_Row);
                    console.log(987)//                                          agbsgnhdrndfhnmzfdnfnz
                    await interaction.showModal(modal);

                    const filter = (interaction) => interaction.customId === "EditProfileModal"
                    interaction
                        .awaitModalSubmit({filter, time: 30_000})
                        .then(async (modalInteraction)=> {
                            const nick_WT_Response = modalInteraction.fields.getTextInputValue("nick_WT_Modal");
                            if(!nick_WT_Response) nick_WT_Response = result.nick_WT;
                            const IDDiscord_Response = modalInteraction.fields.getTextInputValue("IDDiscord_Modal");
                            if(!IDDiscord_Response) IDDiscord_Response = result.IDDiscord;
                            const inClan_Response = modalInteraction.fields.getTextInputValue("inClan_Modal");
                            if(!inClan_Response) inClan_Response = result.inClan;
                            const clan_Response = modalInteraction.fields.getTextInputValue("clan_Modal");
                            if(!clan_Response) clan_Response = result.clan
                            const secondaryAccount_Response = modalInteraction.fields.getTextInputValue("secondaryAccount_Modal");
                            if(!secondaryAccount_Response) secondaryAccount_Response = result.ignoreAbsence

                            const Input = {
                                nick_WT: nick_WT_Response,
                                IDDiscord: IDDiscord_Response,
                                inClan: inClan_Response,
                                clan: clan_Response,
                                secondaryAccount: secondaryAccount_Response,
                                userId: interaction.user.id,
                                guildId: interaction.guild.id
                            }
                            const sanitizedInput = await securityManager.sanitizeInput(Input, {interaction: modalInteraction});

                            klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT: result.nick_WT},{
                                $set:{nick_WT: sanitizedInput.nick_WT, IDDiscord: sanitizedInput.IDDiscord, inClan: sanitizedInput.inClan, clan: sanitizedInput.clan, secondaryAccount: sanitizedInput.secondaryAccount}
                            })
                            modalInteraction.reply({content: language.Profile.EditModalSuccess, ephemeral: true})
                        })
                }
                if(interaction.customId === "ForgiveLimit"){
                    klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT: result.nick_WT},{$set:{forgiveLimit: true}})
                }
            })
            collector.on("end", ()=>{
                EditBtn.setDisabled(true);
                ForgivenLimitBtn.setDisabled(true);

                reply.edit({
                    components:[buttonRow]
                })
            })
        }catch(error){
            console.error(error);
        }
    }
})
/**Searches for results of another squadron againts which was already played
 * 
 */
client.on("interactionCreate", async (interaction) =>{
    if(!interaction.isChatInputCommand())return;
    if(interaction.commandName === "squadron_search"){
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const Input = {
            squadron: interaction.options.get("squadron").value,
            userId: interaction.user.id,
            guildId: interaction.guild.id
        }
        const sanitizedInput = securityManager.sanitizeInput(Input, {interaction});
        const squadron = sanitizedInput.squadron;
            try{
            let results = await klient.db(configuration.DBNames.CW.DB).collection(configuration.DBNames.CW.Collection).find({[language.Misc.Squadron]: squadron, br: actualbr});
            let finishedtable
            let table = new AsciiTable(language.SquadronSearch, squadron);
            table.setHeading(language.Misc.Result, language.Misc.Planes, language.Misc.Helicopters, language.Misc.AA, language.Misc.Comments)
            for(const result of results){
                table.addRow(language.Misc.Result, language.Misc.Planes, language.Misc.Helicopters, language.Misc.AA, language.Misc.Comments)
            }
            finishedtable = '```\n' + table.toString() + '\n```'
            interaction.reply({content: finishedtable, ephemeral: true})
        } catch (error){
            console.error();
        }
    }
})
/**Manual unban of banned member trough this bot (security violations)
 *  This command allows administrators to unban a user who has been banned for security reasons.
 * 
 * Note: logging and reply is hardcoded in english as total refactoring of code is planned in nearish future
 */
client.on("interactionCreate",async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "unban") {
        const secure = await securityManager.checkDiscordSecurity(interaction);
        if(!secure){
            console.log(`${language.security.BannedDscIntCon}${interaction.user.id}`);
            return
        }
        const userId = interaction.options.get("user").value;
        
        try {
            await securityManager.unbanUser(userId, reason);
            interaction.reply({content: `Successfully unbanned user <@${userId}>. Reason: ${reason}`, flags: 64});
            console.log(`Unbanned user <@${userId}>. Reason: ${reason}`);
        } catch (error) {
            console.error(`Failed to unban user <@${userId}>:`, error);
            interaction.reply({content: `Failed to unban user <@${userId}>. Error: ${error.message}`, flags: 64});
        }
    }
});

BotInicialization();