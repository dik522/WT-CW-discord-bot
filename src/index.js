import { EventEmitter } from 'node:events';
import dotenv from "dotenv";
dotenv.config();
import { Client, IntentsBitField, Integration, MessageType, MessageManager, EmbedBuilder} from 'discord.js';
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
export {client};
import {tomorowsDate, actualDate, todaysbr} from "./moduly/obecne_fce.mjs";
import {DayActivity, squadronPoints, brRangeTable, membersPoints, MemberCheck, passwordCheck, clearenceChech, ProfileIniciation} from "./moduly/svazove_fce.mjs";

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
    } catch (err) {
        console.log("Error while loading data from __configuration.json__", err);
    }
}
/**Loads language dataset specified in configuration
 * 
 */
async function loadLanguage(){
    try{
        const json = await fsPromise.readFile("languages/"+ configuration.language +".json", "utf8");
        language = JSON.parse(json);
    }catch(err){
        console.log("Error while loading language dataset: ", err);
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
    await loadConfig();
    await loadLanguage();
    await client.login(process.env.TOKEN);
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
        async () => brRangeTable(configuration, language),
        async () => MemberCheck(process.env.GUILD_ID, configuration, language),
        reset()
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
    const plannedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes, seconds);
    const timeDifference = plannedTime - now;

    if (timeDifference <= 0) {
        plannedTime.setDate(plannedTime.getDate() + 1);
        timeDifference = plannedTime - now;
    }
    setTimeout(async () => {
        for (const cb of callbacks) {
            if (typeof cb === 'function') {
                await cb();
            }else{
                cb();
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
client.on('interactionCreate', (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'season-br') {
        const br1 = interaction.options.get("br1").value;
        const br2 = interaction.options.get("br2").value;
        const br3 = interaction.options.get("br3").value;
        const br4 = interaction.options.get("br4").value;
        const br5 = interaction.options.get("br5").value;
        const br6 = interaction.options.get("br6").value;
        const br7 = interaction.options.get("br7").value;
        const br8 = interaction.options.get("br8").value;
        const br9 = interaction.options.get("season_end").value;

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
                interaction.reply({content:language.CWSeason.BR.SaveError, ephemeral:true})
            } else {
                console.log(language.CWSeason.BR.SaveSuccess, json);
                interaction.reply({content:language.CWSeason.BR.SaveSuccess, ephemeral:true})
            }
        })
    }
})
/**Storing season's dates
 * Does store dates in which br of CW in current season will be changed
 */
client.on('interactionCreate', (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'season_dates') {
        const season_start = interaction.options.get("season_start").value;
        const date1 = interaction.options.get("date1").value;
        const date2 = interaction.options.get("date2").value;
        const date3 = interaction.options.get("date3").value;
        const date4 = interaction.options.get("date4").value;
        const date5 = interaction.options.get("date5").value;
        const date6 = interaction.options.get("date6").value;
        const date7 = interaction.options.get("date7").value;
        const date8 = interaction.options.get("date8").value;
        const season_end = interaction.options.get("season_end").value;

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
                interaction.reply({content:language.CWSeason.Dates.SaveError, ephemeral:true})
            } else {
                console.log(language.CWSeason.Dates.SaveSuccess, json);
                interaction.reply({content:language.CWSeason.Dates.SaveSuccess, ephemeral:true})
            }
        })
    }
})
/**Scraping web for current information of given squadron
 * Scrapes web to get statistics of clan and sends them into given discord chat user by user
 */
client.on('messageCreate',(messages)=> {
    if((messages.content === "scrape:1" && configuration.firstClan.used) || (messages.content ==="scrape:2" && configuration.secondClan.used) || (messages.content ==="scrape:3" && configuration.thirdClan.used) || (messages.content === "scrape:4" && configuration.fourthClan.used)){ {
        let messageContent = messages.content.split(":");
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
        axios(url)
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
            const functionOF = interaction.options.get("switch_function")?.value;
            const OF = interaction.options.get("switch_on_off")?.value;
            const channel = interaction.options.get("function_channel")?.value;
            const ID = interaction.options.get("channel_id")?.value;
            const password = interaction.options.get("password").value;
            const svaz = interaction.options.get("clan").value;
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
                            interaction.reply({content:language.Configuration.Error, ephemeral:true})
                        }else{
                            console.log(language.Configuration.SuccessConsole, interaction.user.username, configuration);
                            interaction.reply({content:language.Configuration.Success, ephemeral:true})
                        }
                    })
                }else{
                    interaction.reply({content:language.Configuration.WrongChoise, ephemeral:true})
                }
            }
        }
    }catch (error){
        interaction.reply({content:language.Configuration.ChangeError, ephemeral:true})
        console.error(language.Configuration.ErrorConsole, error);
    }
})
/**Inicialization of member's profile
 * Does initialize DB profile of new clan member
 */
client.on("interactionCreate", (interaction)=>{
    if(!interaction.isChatInputCommand()) return
    if(interaction.commandName === "init_profile"){
        const WTNick = interaction.options.get("nickwt").value;
        const IDDsc = interaction.options.get("discordid").value;
        const squadron = interaction.options.get("squadron").value;
        const comments = interaction.options.get("comments").value;
        ProfileIniciation(WTNick, IDDsc, squadron, comments, actualDate(), language, configuration)
        interaction.reply({content:language.Profile.Created, ephemeral: true})
    }
})
//adding yourself as a logger
client.on("interactionCreate", (interaction)=>{
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName === "evidence"){
    const editor = interaction.options.get("user").value
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
    interaction.reply({content:language.CWResults.EditorAdded, ephemeral:true})
}})


//              slash commands
/**CW entry
 * Provides new entry of clan wars result
 */
client.on("interactionCreate", (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "cw_entry") {
        const result = interaction.options.get("result").value;
        const squadron = interaction.options.get("squadron").value;
        const planes = interaction.options.get("planes").value;
        const helicopters = interaction.options.get("helicopters").value;
        const aa = interaction.options.get("aa").value;
        const reprezentative = interaction.options.get("reprezentative").value;
        const comments = interaction.options.get("comments")?.value;
        const tanks = interaction.options.get("tanks").value;
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
client.on("interactionCreate", (interaction) =>{
    if (!interaction.isChatInputCommand()) return;
    if(interaction.commandName ==="cw_edit"){
        const result = interaction.options.get("result").value;
        const squadron = interaction.options.get("squadron").value;
        const planes = interaction.options.get("planes").value;
        const helicopters = interaction.options.get("helicopters").value;
        const aa = interaction.options.get("aa").value;
        const reprezentative = interaction.options.get("reprezentative").value;
        const comments = interaction.options.get("comments")?.value;
        const tanks = interaction.options.get("tanks").value;
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
        
            interaction.reply({content:language.CWResults.Edit.NonEditor, ephemeral:true})
        }
        interaction.reply({content:language.CWResults.Edit.Success, ephemeral:true})
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
client.on("interactionCreate", (interaction) =>{
    if (!interaction.isChatInputCommand()) return;
    if(interaction.commandName ==="cw_delete"){
        let editor = relations.find(editor => editor.editor === interaction.user.username)
        if(pravelogger == undefined){
            interaction.reply({content:language.CWResults.Delete.NonEditor, ephemeral:true})
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
                        interaction.reply({content:language.CWResults.Delete.Success, ephemeral:true})
                })
            })
    }
})
/**Searches for results of another squadron againts which was already played
 * 
 */
client.on("interactionCreate", (interaction) =>{
    if(!interaction.isChatInputCommand())return;
    if(interaction.commandName === "squadron_search"){
        const squadron = interaction.options.get("squadron").value;
        async()=>{
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
    }
})

BotInicialization();
