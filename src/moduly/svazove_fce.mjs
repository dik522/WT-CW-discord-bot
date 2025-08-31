import axios from 'axios';
import cheerio from 'cheerio';
import {MongoClient} from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
const klient = new MongoClient(process.env.URI);
import AsciiTable from 'ascii-table';
import {tomorowsDate, actualDate} from "./obecne_fce.mjs";
import {client} from "../index.js";

/**Adds today statistics of players into their database profiles
 * 
 * @param {string} br - representing br of CW played today
 * @param {object} clan_config - configuration of specific clan
 * @param {string} date - date of today
 * @param {object} configuration - configuration object
 * @param {object} lang - language dataset
 */
async function membersPoints(br, clan_config, date, configuration, lang) {
    if(clan_config.used){
        try {
            const response = await axios.get(clan_config.URL);
            const html = response.data;
            const $ = cheerio.load(html);
            const members = [];

            $('.squadrons-members__grid-item').each(function() {
                let pole = $(this).text().trim();
                members.push(pole);
            });

            let numberOfMembers = members.length;
            let i = 7;
            let structuredArray = [];

            while (i <= numberOfMembers) {
                structuredArray.push({
                    member: members[i],
                    CWpoints: Number(members[i + 1]),
                    activity: Number(members[i + 2]),
                    role: members[i + 3]
                });
                i += 6;
            }

            for (const element of structuredArray) {
                if(element.CWpoints >= clan_config.standardLimit && element.role == "Private"){
                    klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                        $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}},
                        $set:{acomplishedLimit: true}
                    })
                }else if(element.CWpoints >= clan_config.sergeantLimit){
                    klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                        $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}},
                        $set:{acomplishedLimit: true}
                    })
                }else{
                    klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                        $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}}})
                }
            }
            console.log(lang.statisticDone)

            await checkMissingMembers(structuredArray, clan_config, configuration, lang);
        } catch (error) {
            console.error(lang.statisticError, error);
        }
    }
}

/**Checks for members in clan who are not put into DB
 * 
 */
async function checkMissingMembers(webMembers, clan_config, configuration, lang) {
    try {
        // Získání všech členů klanu z databáze
        const dbMembers = await klient.db(configuration.DBNames.Community.DB)
            .collection(configuration.DBNames.Community.Collection)
            .find({
                inClan: true,
                clan: clan_config.name
            })
            .toArray();
        
        const dbMemberNames = dbMembers.map(member => member.nick_WT);
        
        const missingMembers = webMembers.filter(webMember => 
            !dbMemberNames.includes(webMember.member)
        );
        
        // Pokud jsou chybějící členové, poslat notifikaci na Discord
        if (missingMembers.length > 0) {
            let message = lang.MissingMemberDB
            for (const member of missingMembers){
                message += `${member.member.replace(/([_\-~*])/g, '\\$1')} \n`
            }
            client.channels.fetch(configuration.administrationChannel)
                .then(channel => {
                    channel.send(message)
                })
        }
        
    } catch (error) {
        console.error(lang.MissingMemberError, error);
    }
}

/**Puts data of players who played CW today into a table a sends it to dsc
 * 
 * @param {object} configuration - configuration object
 * @param {object} lang - language dataset
 */
async function DayActivity(configuration, lang) {
    let profiles = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({ inClan: true }).toArray();
    let structuredArray = [];
    let pointsChange;

    for (const profile of profiles) {
        try {
            if(typeof(profile.records) === "undefined"){
                console.log(profile.nick_WT, " ", profile.IDDiscord, lang.MissingRecords);
                continue}
            if(profile.records.length === 1){
                let achieved = profile.acomplishedLimit ? "✓" : "✘"
                structuredArray.push(["↑", profile.nick_WT, profile.records[0].CWpoints, profile.records[0].CWpoints, achieved, profile.clan])}
            else{
                if(profile.records.at(-1).CWpoints != profile.records.at(-2).CWpoints){
                    if(profile.records.at(-1).CWpoints < profile.records.at(-2).CWpoints){
                        pointsChange = "↓"
                    }else{
                        pointsChange = "↑"
                    }
                    let achieved
                    if(profile.acomplishedLimit){achieved = "✓"}else{achieved = "✘"}
                    structuredArray.push([pointsChange, profile.nick_WT, profile.records.at(-1).CWpoints - profile.records.at(-2).CWpoints, profile.records.at(-1).CWpoints, achieved, profile.clan])
                }                
            }
        } catch (error) {
            console.error(configuration.CWPointsError, error);
        }
    }
    let members1 = structuredArray.filter(profile => profile[5] === configuration.firstClan.name)
    let members2 = structuredArray.filter(profile => profile[5] === configuration.secondClan.name)
    let members3 = structuredArray.filter(profile => profile[5] === configuration.thirdClan.name)
    let members4 = structuredArray.filter(profile => profile[5] === configuration.fourthClan.name)
    
    //Table for first clan
    if(configuration.firstClan.used){
        if(configuration.firstClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWPointsTable + configuration.firstClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members1.length){
                table.addRow(members1[q][0], members1[q][1], members1[q][2], members1[q][3], members1[q][4]);
                if(table.toString().length > 1800){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWPointsTable + configuration.firstClan.name);
                    table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
                    const channel = await client.channels.fetch(configuration.firstClan.activityChannel)
                        await channel.send(finishedTable)
                    console.log(finishedTable);//khblskgbrůksrb.sdkjbd.skb
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                const channel = await client.channels.fetch(configuration.firstClan.activityChannel)
                    await channel.send(finishedTable)
            }else{
                const channel = await client.channels.fetch(configuration.firstClan.activityChannel)
                    await channel.send(lang.CWPointsEmpty + configuration.firstClan.name)
            }
        }
    }
    //Table for second clan
    if(configuration.secondClan.used){
        if(configuration.secondClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWPointsTable + configuration.secondClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members2.length){
                table.addRow(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4]);
                if(table.toString().length > 1800){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWPointsTable + configuration.secondClan.name);
                    table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
                    const channel = await client.channels.fetch(configuration.secondClan.activityChannel);
                    await channel.send(finishedTable);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                const channel = await client.channels.fetch(configuration.secondClan.activityChannel)
                    await channel.send(finishedTable);
            }else{
                const channel = await client.channels.fetch(configuration.secondClan.activityChannel);
                    await channel.send(lang.CWPointsEmpty + configuration.secondClan.name);
            }
        }
    }
    //Table for third clan
    if(configuration.thirdClan.used){
        if(configuration.thirdClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWPointsTable + configuration.thirdClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members3.length){
                table.addRow(members3[q][0], members3[q][1], members3[q][2], members3[q][3], members3[q][4]);
                if(table.toString().length > 1800){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWPointsTable + configuration.thirdClan.name);
                    table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
                    const channel = await client.channels.fetch(configuration.thirdClan.activityChannel);
                    await channel.send(finishedTable);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                const channel = await client.channels.fetch(configuration.thirdClan.activityChannel);
                await channel.send(finishedTable);
            }else{
                const channel = await client.channels.fetch(configuration.thirdClan.activityChannel);
                await channel.send(lang.CWPointsEmpty + configuration.thirdClan.name);
            }
        }
    }
    //Table for fourth clan
    if(configuration.fourthClan.used){
        if(configuration.fourthClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWPointsTable + configuration.fourthClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members4.length){
                table.addRow(members4[q][0], members4[q][1], members4[q][2], members4[q][3], members4[q][4]);
                if(table.toString().length > 1800){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWPointsTable + configuration.fourthClan.name);
                    table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
                    const channel = await client.channels.fetch(configuration.fourthClan.activityChannel);
                    await channel.send(finishedTable);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
               const channel = await client.channels.fetch(configuration.fourthClan.activityChannel);
               await channel.send(finishedTable);
            }else{
                const channel = await client.channels.fetch(configuration.fourthClan.activityChannel);
                await channel.send(lang.CWPointsEmpty + configuration.fourthClan.name);
            }
        }
    }
    console.log(lang.dayActivity)
}

/**Fetches and sends squadron points
 * 
 * @param {object} configuration - configuration object of specific clan (configuration.firstClan, configuration.secondClan, etc.)
 * @param {object} lang - language dataset
 */

async function squadronPoints(configuration, lang) {
    if(configuration.used){
        if (configuration.headerOF) {
            try {
                const response = await axios.get(configuration.URL);
                const html = response.data;
                const $ = cheerio.load(html);
                const svazObecne = [];

                $('.squadrons-counter__value').each(function() {
                    let pole = $(this).text().trim();
                    svazObecne.push(pole);
                });

                const kanal = configuration.headerChannel;
                const channel = await client.channels.fetch(kanal);
                const message = lang.SquadronPoints + svazObecne[0];
                await channel.send(message);
                console.log(lang.squadonPointsDone, configuration.name)
            } catch (error) {
                console.error(lang.SquadronPointsError, error);
            }
        }
    }
}

/**Does create profile of player on given parameters
 * 
 * @param {string} interactionWTNick - WT nickname
 * @param {string} interactionDscID - Discord ID
 * @param {string} interactionClan - squadron name
 * @param {string} interactioncomments - comments to add into this profile
 * @param {string} dnesniDatum - today's date
 * @param {object} lang - language dataset
 * @param {object} configuration - configuration object
 */
async function ProfileIniciation(interactionWTNick, interactionDscID, interactionClan, interactioncomments, dnesniDatum, lang, configuration, interaction) {
    let existingProfile = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({nick_WT: interactionWTNick}).toArray();
    if(existingProfile[0]){
        interaction.reply({content: lang.Profile.AlreadyExist, ephemeral: true});
        return;
    }
    try {
        let profile = {
            nick_WT: interactionWTNick,
            IDDiscord: interactionDscID,
            joinDate: dnesniDatum,
            inClan: true,
            clan: interactionClan,
            acomplishedLimit:false,
            comments: interactioncomments,
            ignoreAbsence: false
        };

        await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).insertOne(profile);
        console.log(lang.Profile.Created);
        interaction.reply({content:lang.Profile.Created, ephemeral: true});
    } catch (error) {
        console.error(lang.Profile.Error, error);
    }
}

/**Makes table of members activity in br range
 * 
 * @param {Array} season - array of dates when br is changed and appropriate br 
 * @param {object} configuration - configuration object
 * @param {object} lang - language dataset
 * @returns 
 */
async function brRangeTable(season, configuration, lang) {
    let profiles = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({ inClan: true }).toArray();
    let structuredArray = [];
    let todayDate =actualDate();
    for(const range of season){
        if(range.interval[1] == todayDate){
            for (const profile of profiles) {
                try {
                    let achieved;
                    if(profile.records.length < 7){
                        throw new Error("Profile has less than 7 zaznamy in 'zaznamy'");
                    }
                    let i= -7;
                    while(profile.records.at(i).date != range.interval[0]){
                        i+=1;
                    }
                    let pointsChange
                    if(profile.records.at(-1).CWpoints < profile.records.at(i).CWpoints){
                        pointsChange = "↓"
                    }else{
                        pointsChange = "↑"
                    }
                    if(profile.acomplishedLimit){achieved = "✓"}else{achieved = "✘"}
                    structuredArray.push([pointsChange, profile.nick_WT, profile.records.at(-1).CWpoints - profile.records.at(i).CWpoints, profile.records.at(-1).CWpoints, achieved, profile.svaz])
                } catch (error) {
                    if(error.message === "Profile has less than 7 zaznamy in 'zaznamy'"){
                        let achieved = profile.acomplishedLimit ? "✓" : "✘";
                        structuredArray.push(["↑", profile.nick_WT, profile.records.at(-1).CWpoints, profile.records.at(-1).CWpoints, achieved, profile.svaz])
                    }else{
                        console.error(lang.brRangeError, error);
                    }
                }
            }
            try{
                let members1 = [];
                members1 = structuredArray.filter(profile => profile[5] === configuration.firstClan.name)
                let members2 = [];
                members2 = structuredArray.filter(profile => profile[5] === configuration.secondClan.name)
                let members3 = [];
                members3 = structuredArray.filter(profile => profile[5] === configuration.thirdClan.name)
                let members4 = [];
                members4 = structuredArray.filter(profile => profile[5] === configuration.fourthClan.name)
                
                //Table for first clan
                if(configuration.firstClan.used){
                    if(configuration.firstClan.brInfoOF){
                        let q = 0;
                        let finishedTable
                        let table = new AsciiTable(lang.brRangeTable, configuration.firstClan.name);
                        table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                        while(q<members1.length){
                            table.addRow(members1[q][0], members1[q][1], members1[q][2], members1[q][3], members1[q][4]);
                            if(table.toString().length > 2000){
                                finishedTable = '```\n' + table.toString() + '\n ```';
                                table = new AsciiTable(lang.brRangeTable, configuration.firstClan.name);
                                table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                                const channel = await client.channels.fetch(configuration.firstClan.brInfoChannel);
                                await channel.send(finishedTable);
                                finishedTable ="";
                            }
                            q = q+1;
                        }
                        finishedTable = '```\n' + table.toString() + '\n ```';            
                        if(q > 0){
                            const channel = await client.channels.fetch(configuration.firstClan.brInfoChannel);
                            await channel.send(finishedTable);
                        }else{
                            console.log(lang.brRangeEmpty, configuration.firstClan.name);
                        }
                    }
                }
                //Table for second clan
                if(configuration.secondClan.used){
                    if(configuration.secondClan.brInfoOF){
                        let q = 0;
                        let finishedTable = ""
                        let table = new AsciiTable(lang.brRangeTable, configuration.secondClan.name);
                        table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                        while(q<members2.length){
                            table.addRow(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4]);
                            console.log(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4])
                            if(table.toString().length > 2000){
                                finishedTable = '```\n' + table.toString() + '\n ```';
                                table = new AsciiTable(lang.brRangeTable, configuration.secondClan.name);
                                table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                                const channel = await client.channels.fetch(configuration.secondClan.brInfoChannel);
                                await channel.send(finishedTable);
                                finishedTable ="";
                            }
                            q = q+1;
                        }
                        finishedTable = '```\n' + table.toString() + '\n ```';            
                        if(q > 0){
                            const channel = await client.channels.fetch(configuration.secondClan.brInfoChannel);
                            await channel.send(finishedTable);
                        }else{
                            console.log(lang.brRangeEmpty, configuration.secondClan.name);
                        }
                    }
                }
                //Table for third clan
                if(configuration.thirdClan.used){
                    if(configuration.thirdClan.brInfoOF){
                        let q = 0;
                        let finishedTable = ""
                        let table = new AsciiTable(lang.brRangeTable, configuration.thirdClan.name);
                        table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                        while(q<members3.length){
                            table.addRow(members3[q][0], members3[q][1], members3[q][2], members3[q][3], members3[q][4]);
                            if(table.toString().length > 2000){
                                finishedTable = '```\n' + table.toString() + '\n ```';
                                table = new AsciiTable(lang.brRangeTable, configuration.thirdClan.name);
                                table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                                const channel = await client.channels.fetch(configuration.thirdClan.brInfoChannel);
                                await channel.send(finishedTable);
                                finishedTable ="";
                            }
                            q = q+1;
                        }
                        finishedTable = '```\n' + table.toString() + '\n ```';
                        if(q > 0){
                            const channel = await client.channels.fetch(configuration.thirdClan.brInfoChannel);
                            await channel.send(finishedTable);
                        }else{
                            console.log(lang.brRangeEmpty, configuration.thirdClan.name);
                        }
                    }
                }
                //Table for fourth clan
                if(configuration.fourthClan.used){
                    if(configuration.fourthClan.brInfoOF){
                        let q = 0;
                        let finishedTable = ""
                        let table = new AsciiTable(lang.brRangeTable, configuration.fourthClan.name);
                        table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                        while(q<members4.length){
                            table.addRow(members4[q][0], members4[q][1], members4[q][2], members4[q][3], members4[q][4]);
                            if(table.toString().length > 2000){
                                finishedTable = '```\n' + table.toString() + '\n ```';
                                table = new AsciiTable(lang.brRangeTable, configuration.fourthClan.name);
                                table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                                const channel = await client.channels.fetch(configuration.fourthClan.brInfoChannel);
                                await channel.send(finishedTable);
                                finishedTable ="";
                            }
                            q = q+1;
                        }
                        finishedTable = '```\n' + table.toString() + '\n ```';
                        if(q > 0){
                            const channel = await client.channels.fetch(configuration.fourthClan.brInfoChannel);
                                await channel.send(finishedTable);
                        }else{
                            console.log(lang.brRangeEmpty, configuration.fourthClan.name);
                        }
                    }
                }
                console.log(lang.brRangeDone)
                break
            }
            catch (error) {
                console.error(error);
            }
        }
    }
}

/**At end of season sends summary of members points and limit acomplishment
 * 
 */

async function SeasonSummary (conf, lang, season){
    let todayDate = actualDate();
    if (season.at(-1).interval[1] == todayDate){
        let profiles = await klient.db(conf.DBNames.Community.DB).collection(conf.DBNames.Community.Collection).find({inClan: true}).toArray();
        let acomplishedLim1 = [], acomplishedLim2 = [], acomplishedLim3 = [], acomplishedLim4 = [];
        let failedLim1 = [], failedLim2 = [], failedLim3 = [], failedLim4 = [];
        let forgivenLim1 = [], forgivenLim2 = [], forgivenLim3 = [], forgivenLim4 = [];
        let newMember1 = [], newMember2 = [], newMember3 = [], newMember4 = [];
        for (const profile of profiles){
            try{
                if(!profile.records) {
                    console.warn(`${lang.Misc.Player} ${profile.nick_WT} ${lang.Misc.NoRecords}`);
                    continue;
                }
                let prevSeason = {
                        CWpoints: profile.records.at(-1).CWpoints, 
                        activity: profile.records.at(-1).activity, 
                        role: profile.records.at(-1).role, 
                        forgiveLimit: profile.forgiveLimit, 
                        acomplishedLimit: profile.acomplishedLimit
                };
                await klient.db(conf.DBNames.Community.DB).collection(conf.DBNames.Community.Collection).updateOne({nick_WT: profile.nick_WT},{
                    $push:{prevSeason:prevSeason},
                    $set:{records: [], acomplishedLimit: false, forgiveLimit: false}
                },{upsert: true});
                function SortByLimit(clanConf, profile, newMember, acomplishedLim, forgivenLim, failedLim){
                    if (clanConf.used && clanConf.name === profile.clan) {
                        if (typeof profile.prevSeason === "undefined") {
                            let thisSeason;
                            if (profile.acomplishedLimit) {
                                thisSeason = "✓";
                            } else if (profile.forgiveLimit) {
                                thisSeason = "F";
                            } else {
                                thisSeason = "✘";
                            }
                            newMember.push({
                                nick_WT: profile.nick_WT, 
                                CWpoints: profile.records.at(-1).CWpoints, 
                                activity: profile.records.at(-1).activity, 
                                thisSeason: thisSeason, 
                                previousSeason: "N"
                            });
                        } else if (profile.acomplishedLimit) {
                            let previousSeason;
                            let lastPrevSeason = profile.prevSeason.at(-1);
                            if (lastPrevSeason.acomplishedLimit) {
                                previousSeason = "✓";
                            } else if (lastPrevSeason.forgiveLimit) {
                                previousSeason = "F";
                            } else {
                                previousSeason = "✘";
                            }
                            acomplishedLim.push({
                                nick_WT: profile.nick_WT, 
                                CWpoints: profile.records.at(-1).CWpoints, 
                                activity: profile.records.at(-1).activity, 
                                thisSeason: "✓", 
                                previousSeason: previousSeason
                            });
                        } else if (profile.forgiveLimit) {
                            let previousSeason;
                            let lastPrevSeason = profile.prevSeason.at(-1);
                            if (lastPrevSeason.acomplishedLimit) {
                                previousSeason = "✓";
                            } else if (lastPrevSeason.forgiveLimit) {
                                previousSeason = "F";
                            } else {
                                previousSeason = "✘";
                            }
                            forgivenLim.push({
                                nick_WT: profile.nick_WT, 
                                CWpoints: profile.records.at(-1).CWpoints, 
                                activity: profile.records.at(-1).activity, 
                                thisSeason: "F", 
                                previousSeason: previousSeason
                            });
                        } else {
                            let previousSeason;
                            let lastPrevSeason = profile.prevSeason.at(-1);
                            if (lastPrevSeason.acomplishedLimit) {
                                previousSeason = "✓";
                            } else if (lastPrevSeason.forgiveLimit) {
                                previousSeason = "F";
                            } else {
                                previousSeason = "✘";
                            }
                            failedLim.push({
                                nick_WT: profile.nick_WT, 
                                CWpoints: profile.records.at(-1).CWpoints, 
                                activity: profile.records.at(-1).activity, 
                                thisSeason: "✘", 
                                previousSeason: previousSeason
                            });
                        }
                    }
                }
                SortByLimit(conf.firstClan, profile, newMember1, acomplishedLim1, forgivenLim1, failedLim1);
                SortByLimit(conf.secondClan, profile, newMember2, acomplishedLim2, forgivenLim2, failedLim2);
                SortByLimit(conf.thirdClan, profile, newMember3, acomplishedLim3, forgivenLim3, failedLim3);
                SortByLimit(conf.fourthClan, profile, newMember4, acomplishedLim4, forgivenLim4, failedLim4);
            }catch(err){
                console.error(lang.SeasonSummaryError, err)
            }
        }
        function SortSortedArrays(newMember, acomplishedLim, failedLim, forgivenLim) {
            const sortFunction = (a, b) => {
                const param1 = a.nick_WT.toUpperCase();
                const param2 = b.nick_WT.toUpperCase();
                if (param1 < param2) return -1;
                if (param1 > param2) return 1;
                return 0;
            };
            
            newMember.sort(sortFunction);
            acomplishedLim.sort(sortFunction);
            forgivenLim.sort(sortFunction);
            failedLim.sort(sortFunction);
            
            acomplishedLim.push(...forgivenLim, ...failedLim, ...newMember);
        }
        SortSortedArrays(newMember1, acomplishedLim1, failedLim1, forgivenLim1);
        SortSortedArrays(newMember2, acomplishedLim2, failedLim2, forgivenLim2);
        SortSortedArrays(newMember3, acomplishedLim3, failedLim3, forgivenLim3);
        SortSortedArrays(newMember4, acomplishedLim4, failedLim4, forgivenLim4);
        
        async function sendTable(clanConf, lang, array) {
                if (clanConf.used && array.length > 0) {
                    try {
                        let finishedTable = "";
                        let table = new AsciiTable(lang.SeasonEndTable, clanConf.name);
                        table.setHeading(lang.Misc.Player, lang.Misc.CWPoints, lang.Misc.Activity, lang.Misc.ThisSeason, lang.Misc.PreviousSeason);
                        
                        for (const member of array) {
                            table.addRow(member.nick_WT, member.CWpoints, member.activity, member.thisSeason, member.previousSeason);
                            
                            if (table.toString().length > 2000) {
                                finishedTable = '```\n' + table.toString() + '\n```';
                                const channel = await client.channels.fetch(clanConf.seasonEndChannel);
                                await channel.send(finishedTable);
                                
                                table = new AsciiTable(lang.SeasonEndTable, clanConf.name);
                                table.setHeading(lang.Misc.Player, lang.Misc.CWPoints, lang.Misc.Activity, lang.Misc.ThisSeason, lang.Misc.PreviousSeason);
                                finishedTable = "";
                            }
                        }
                        
                        if (table.rows.length > 0) {
                            finishedTable = '```\n' + table.toString() + '\n```';
                            const channel = await client.channels.fetch(clanConf.seasonEndChannel);
                            await channel.send(finishedTable);
                        }
                    } catch (err) {
                        console.error(`${lang.SeasonTableError} ${clanConf.name}:`, err);
                    }
                }
            }
        await sendTable(conf.firstClan, lang, acomplishedLim1);
        await sendTable(conf.secondClan, lang, acomplishedLim2);
        await sendTable(conf.thirdClan, lang, acomplishedLim3);
        await sendTable(conf.fourthClan, lang, acomplishedLim4);
    }
}
/**Does check if members informations are up to date
 * 
 * @param {string} guildID - guild ID
 * @param {object} configuration - configuration object
 * @param {object} lang - language dataset
 */
async function MemberCheck(guildID, configuration, lang) {
    let profiles = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({ inClan: true }).toArray();
    const guild = client.guilds.cache.get(guildID);

    for (const profile of profiles) {
        try {
            if (profile.IDDiscord != 404 && profile.ignoreAbsence != true) {
                //404 for completelly shared accounts
                //ignoreAbsence for secondary accounts
                const member = await guild.members.fetch(profile.IDDiscord);
                switch (profile.clan) {
                    case configuration.firstClan.name:
                        if(!member.roles.cache.has(configuration.firstClan.RoleID)){
                            console.log("Role missing: ", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.RoleMissing}<@&${configuration.firstClan.RoleID}>`);
                        }
                        if(!profile.records.at(-1).date == actualDate()){
                            console.log("Member missing", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.NotFound}`);
                        }
                        break;
                    case configuration.secondClan.name:
                        if(!member.roles.cache.has(configuration.secondClan.RoleID)){
                            console.log("Role missing: ", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.RoleMissing}<@&${configuration.secondClan.RoleID}>`);
                        }
                        if(!profile.records.at(-1).date == actualDate()){
                            console.log("Member missing", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.NotFound}`);
                        }
                        break;
                    case configuration.thirdClan.name:
                        if(!member.roles.cache.has(configuration.thirdClan.RoleID)){
                            console.log("Role missing: ", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.RoleMissing}<@&${configuration.thirdClan.RoleID}>`);
                        }
                        if(!profile.records.at(-1).date == actualDate()){
                            console.log("Member missing", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.NotFound}`);
                        }
                        break;
                    case configuration.fourthClan.name:
                        if(!member.roles.cache.has(configuration.fourthClan.RoleID)){
                            console.log("Role missing: ", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.RoleMissing}<@&${configuration.fourthClan.RoleID}>`);
                        }
                        if(!profile.records.at(-1).date == actualDate()){
                            console.log("Member missing", profile.nick_WT, " ", profile.IDDiscord)
                            const channel = await client.channels.fetch(configuration.administrationChannel);
                            await channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.NotFound}`);
                        }
                        break;
                    default:
                        const channel = await client.channels.fetch(configuration.administrationChannel);
                        await channel.send(`:warning: \n${lang.memberCheck.CheckProfile}<@${profile.IDDiscord}>${lang.memberCheck.Owner}${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}`);
                        break;
                }
            }
        } catch (error) {
            if (error.code === 10007 || error.code === 10013) {
                const channel = await client.channels.fetch(configuration.administrationChannel);
                await channel.send(`:bangbang: \n${profile.nick_WT}${lang.memberCheck.Squadron}${profile.clan}${lang.memberCheck.DscNotFound}`);
            }else{
                console.log(error);
            }
        }
    }
}

async function passwordCheck(checkedPassword, passwords) {
    const user = passwords.find(reference => reference.password === checkedPassword);
    if (!user){
        return{success:false};
    }
    return {success: true, user: user};
}

async function clearenceChech(user, allowedClearence) {
    if(user.clearence === "developer"){
        return {success: true};
    }else if(allowedClearence.indexOf(user.clearence) != -1){
        return {success: true};
    }
    return {success: false};
}
export {DayActivity, squadronPoints, ProfileIniciation, brRangeTable, MemberCheck, membersPoints, passwordCheck, clearenceChech, SeasonSummary}