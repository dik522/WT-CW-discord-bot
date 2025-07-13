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
                    CWpoints: members[i + 1],
                    activity: members[i + 2],
                    role: members[i + 3]
                });
                i += 6;
            }

            for (const element of structuredArray) {
                    if(element.records != undefined){
                        if(element.records.at(-1).CWpoints >= clan_config.standardLimit && element.records.at(-1).role == "Private"){
                            klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                                $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}},
                                $set:{acomplishedLimit: true}
                            })
                        }else if(element.records.at(-1).CWpoints >= clan_config.sergeantLimit){
                            klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                                $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}},
                                $set:{acomplishedLimit: true}
                            })
                        }else{
                            klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                                $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}}})
                        }
                    }else{
                        klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).updateOne({nick_WT:element.member}, {
                            $push:{records: {CWpoints: element.CWpoints, activity: element.activity, role: element.role, date: date, br: br}}})
                    }
            }
        } catch (error) {
            console.error(lang.statisticError, error);
        }
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
                    structuredArray.push([pointsChange, profile.nick_WT, profile.records.at(-2).CWpoints - profile.records.at(-1).CWpoints, profile.records.at(-1).CWpoints, achieved, profile.clan])
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
    
    //Table for firt clan
    if(configuration.firstClan.used){
        if(configuration.firstClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWpointsTable + configuration.firstClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members1.length){
                table.addRow(members1[q][0], members1[q][1], members1[q][2], members1[q][3], members1[q][4]);
                if(table.toString().length > 2000){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWpointsTable + configuration.firstClan.name);
                    table.setHeading(configuration.Misc.PointsChange, configuration.Misc.Player, configuration.Misc.PointsDifference, configuration.Misc.PointsActual,configuration.Misc.PointsLimit);
                    client.channels.fetch(configuration.firstClan.activityChannel)
                        .then(channel => channel.send(finishedTable))
                        .catch(console.error);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                client.channels.fetch(configuration.firstClan.activityChannel)
                    .then(channel => channel.send(finishedTable))
                    .catch(console.error);
            }else{
                client.channels.fetch(configuration.firstClan.activityChannel)
                    .then(channel => channel.send(lang.CWPointsEmpty + configuration.firstClan.name))
                    .catch(console.error);
            }
        }
    }
    //Table for second clan
    if(configuration.secondClan.used){
        if(configuration.secondClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWpointsTable + configuration.secondClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members2.length){
                table.addRow(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4]);
                if(table.toString().length > 2000){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWpointsTable + configuration.secondClan.name);
                    table.setHeading(configuration.Misc.PointsChange, configuration.Misc.Player, configuration.Misc.PointsDifference, configuration.Misc.PointsActual,configuration.Misc.PointsLimit);
                    client.channels.fetch(configuration.secondClan.activityChannel)
                        .then(channel => channel.send(finishedTable))
                        .catch(console.error);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                client.channels.fetch(configuration.secondClan.activityChannel)
                    .then(channel => channel.send(finishedTable))
                    .catch(console.error);
            }else{
                client.channels.fetch(configuration.secondClan.activityChannel)
                    .then(channel => channel.send(lang.CWPointsEmpty + configuration.secondClan.name))
                    .catch(console.error);
            }
        }
    }
    //Table for third clan
    if(configuration.thirdClan.used){
        if(configuration.thirdClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWpointsTable + configuration.thirdClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members3.length){
                table.addRow(members3[q][0], members3[q][1], members3[q][2], members3[q][3], members3[q][4]);
                if(table.toString().length > 2000){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWpointsTable + configuration.thirdClan.name);
                    table.setHeading(configuration.Misc.PointsChange, configuration.Misc.Player, configuration.Misc.PointsDifference, configuration.Misc.PointsActual,configuration.Misc.PointsLimit);
                    client.channels.fetch(configuration.thirdClan.activityChannel)
                        .then(channel => channel.send(finishedTable))
                        .catch(console.error);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                client.channels.fetch(configuration.thirdClan.activityChannel)
                    .then(channel => channel.send(finishedTable))
                    .catch(console.error);
            }else{
                client.channels.fetch(configuration.thirdClan.activityChannel)
                    .then(channel => channel.send(lang.CWPointsEmpty + configuration.thirdClan.name))
                    .catch(console.error);
            }
        }
    }
    //Table for fourth clan
    if(configuration.fourthClan.used){
        if(configuration.fourthClan.activityOF){
            let q = 0;
            let finishedTable
            let table = new AsciiTable(lang.CWpointsTable + configuration.fourthClan.name);
            table.setHeading(lang.Misc.PointsChange, lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual,lang.Misc.PointsLimit);
            while(q<members4.length){
                table.addRow(members4[q][0], members4[q][1], members4[q][2], members4[q][3], members4[q][4]);
                if(table.toString().length > 2000){
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    table = new AsciiTable(lang.CWpointsTable + configuration.fourthClan.name);
                    table.setHeading(configuration.Misc.PointsChange, configuration.Misc.Player, configuration.Misc.PointsDifference, configuration.Misc.PointsActual,configuration.Misc.PointsLimit);
                    client.channels.fetch(configuration.fourthClan.activityChannel)
                        .then(channel => channel.send(finishedTable))
                        .catch(console.error);
                    finishedTable ="";
                }
                q = q+1;
            }
            finishedTable = '```\n' + table.toString() + '\n ```';            
            if(q > 0){
                client.channels.fetch(configuration.fourthClan.activityChannel)
                    .then(channel => channel.send(finishedTable))
                    .catch(console.error);
            }else{
                client.channels.fetch(configuration.fourthClan.activityChannel)
                    .then(channel => channel.send(lang.CWPointsEmpty + configuration.fourthClan.name))
                    .catch(console.error);
            }
        }
    }
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
                const message = lang.SquadronPoints +svazObecne[0];
                await channel.send(message);
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
async function ProfileIniciation(interactionWTNick, interactionDscID, interactionClan, interactioncomments, dnesniDatum, lang, configuration) {
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
    let profiles = await klient.db(configuration.DBNames.Community.DB).collection(configuration.DBNames.Community.Collection).find({ aktualneVeSvazu: true }).toArray();
    let structuredArray = [];
    let achieved
    let todayDate =actualDate();
    for(const range of season){
        if(range.interval[1] == todayDate){
            for (const profile of profiles) {
                try {
                    if(profile.zaznamy.length < 7){
                        throw new Error("Profile has less than 7 zaznamy in 'zaznamy'");
                    }
                    let i= -7;
                    while(profile.zaznamy.at(i).datum != range.interval[0]){
                        i+=1;
                    }
                    let pointsChange
                    if(profile.zaznamy.at(-1).CWbody < profile.zaznamy.at(i).CWbody){
                        pointsChange = "↓"
                    }else{
                        pointsChange = "↑"
                    }
                    if(profile.acomplishedLimit){achieved = "✓"}else{achieved = "✘"}
                    structuredArray.push([pointsChange, profile.nick_WT, profile.zaznamy.at(i).CWbody - profile.zaznamy.at(-1).CWbody, profile.zaznamy.at(-1).CWbody, achieved, profile.svaz])
                } catch (error) {
                    if(Error == "Profile has less than 7 zaznamy in 'zaznamy'"){
                        structuredArray.push(["↑", profile.nick_WT, profile.zaznamy.at(-1).CWbody, profile.zaznamy.at(-1).CWbody, achieved, profile.svaz])
                    }else{
                        console.error(lang.brRangeError, error, "i: ", i);
                    }
                }
            }
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
                    let table = new AsciiTable(lang.brRangeTable + configuration.firstClan.name);
                    table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                    while(q<members1.length){
                        table.addRow(members1[q][0], members1[q][1], members1[q][2], members1[q][3], members1[q][4]);
                        if(table.toString().length > 2000){
                            finishedTable = '```\n' + table.toString() + '\n ```';
                            table = new AsciiTable(lang.brRangeTable + configuration.firstClan.name);
                            table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                            client.channels.fetch(configuration.firstClan.brInfoChannel)
                                .then(channel => channel.send(finishedTable))
                                .catch(console.error);
                            finishedTable ="";
                        }
                        q = q+1;
                    }
                    finishedTable = '```\n' + table.toString() + '\n ```';            
                    if(q > 0){
                        client.channels.fetch(configuration.firstClan.brInfoChannel)
                            .then(channel => channel.send(finishedTable))
                            .catch(console.error);
                    }else{
                        console.log(lang.brRangeEmpty + configuration.firstClan.name);
                    }
                }
            }
            //Table for second clan
            if(configuration.secondClan.used){
                if(configuration.secondClan.brInfoOF){
                    let q = 0;
                    let finishedTable = ""
                    let table = new AsciiTable(lang.brRangeTable + configuration.secondClan.name);
                    table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                    while(q<members2.length){
                        table.addRow(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4]);
                        console.log(members2[q][0], members2[q][1], members2[q][2], members2[q][3], members2[q][4])
                        if(table.toString().length > 2000){
                            finishedTable = '```\n' + table.toString() + '\n ```';
                            table = new AsciiTable(lang.brRangeTable + configuration.secondClan.name);
                            table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                            client.channels.fetch(configuration.secondClan.brInfoChannel)
                                .then(channel => channel.send(finishedTable))
                                .catch(console.error);
                            finishedTable ="";
                        }
                        q = q+1;
                    }
                    finishedTable = '```\n' + table.toString() + '\n ```';            
                    if(q > 0){
                        client.channels.fetch(configuration.secondClan.brInfoChannel)
                            .then(channel => channel.send(finishedTable))
                            .catch(console.error);
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
                    let table = new AsciiTable(lang.brRangeTable + configuration.thirdClan.name);
                    table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                    while(q<members3.length){
                        table.addRow(members3[q][0], members3[q][1], members3[q][2], members3[q][3], members3[q][4]);
                        if(table.toString().length > 2000){
                            finishedTable = '```\n' + table.toString() + '\n ```';
                            table = new AsciiTable(lang.brRangeTable + configuration.thirdClan.name);
                            table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                            client.channels.fetch(configuration.thirdClan.brInfoChannel)
                                .then(channel => channel.send(finishedTable))
                                .catch(console.error);
                            finishedTable ="";
                        }
                        q = q+1;
                    }
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    if(q > 0){
                        client.channels.fetch(configuration.thirdClan.brInfoChannel)
                            .then(channel => channel.send(finishedTable))
                            .catch(console.error);
                    }else{
                        console.log(lang.brRangeEmpty);
                    }
                }
            }
            //Table for fourth clan
            if(configuration.fourthClan.used){
                if(configuration.fourthClan.brInfoOF){
                    let q = 0;
                    let finishedTable = ""
                    let table = new AsciiTable(lang.brRangeTable + configuration.fourthClan.name);
                    table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                    while(q<members4.length){
                        table.addRow(members4[q][0], members4[q][1], members4[q][2], members4[q][3], members4[q][4]);
                        if(table.toString().length > 2000){
                            finishedTable = '```\n' + table.toString() + '\n ```';
                            table = new AsciiTable(lang.brRangeTable + configuration.fourthClan.name);
                            table.setHeading(lang.Misc.PointsChange,lang.Misc.Player, lang.Misc.PointsDifference, lang.Misc.PointsActual, lang.Misc.PointsLimit);
                            client.channels.fetch(configuration.fourthClan.brInfoChannel)
                                .then(channel => channel.send(finishedTable))
                                .catch(console.error);
                            finishedTable ="";
                        }
                        q = q+1;
                    }
                    finishedTable = '```\n' + table.toString() + '\n ```';
                    if(q > 0){
                        client.channels.fetch(configuration.fourthClan.brInfoChannel)
                            .then(channel => channel.send(finishedTable))
                            .catch(console.error);
                    }else{
                        console.log(lang.brRangeEmpty);
                    }
                }
            }
            break
        }
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
            if (profile.IDDiscord != 404 || profile.ignoreAbsence != true) {
                //404 for completelly shared accounts
                //ignoreAbsence for secondary accounts
                const member = await guild.members.fetch(profile.IDDiscord);
                switch (profile.clan) {
                    case configuration.firstClan.name:
                        if(!member.roles.cache.has(configuration.firstClan.RoleID)){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.RoleMissing}<@&${configuration.firstClan.RoleID}>`)
                                })
                        }
                        if(!profile.records.at(-1).datum == actualDate()){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.NotFound}`)
                                })
                        }
                        break;
                    case configuration.secondClan.name:
                        if(!member.roles.cache.has(configuration.secondClan.RoleID)){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.RoleMissing}<@&${configuration.secondClan.RoleID}>`)
                                })
                        }
                        if(!profile.records.at(-1).datum == actualDate()){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.NotFound}`)
                                })
                        }
                        break;
                    case configuration.thirdClan.name:
                        if(!member.roles.cache.has(configuration.thirdClan.RoleID)){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.RoleMissing}<@&${configuration.thirdClan.RoleID}>`)
                                })
                        }
                        if(!profile.records.at(-1).datum == actualDate()){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.NotFound}`)
                            })   
                        }
                        break;
                    case configuration.fourthClan.name:
                        if(!member.roles.cache.has(configuration.fourthClan.RoleID)){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning:\n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.RoleMissing}<@&${configuration.fourthClan.RoleID}>`)
                            })
                        }
                        if(!profile.records.at(-1).datum == actualDate()){
                            klient.channels.fetch(configuration.administrationChannel)
                                .then(channel => {
                                    channel.send(`:warning: \n<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.NotFound}`)
                            })   
                        }
                        break;
                    default:
                    klient.channels.fetch(configuration.administrationChannel)
                        .then(channel => {
                            channel.send(`:warning: \n${lang.MemberCheck.CheckProfile}<@${profile.IDDiscord}>${lang.MemberCheck.Owner}${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}`)
                        })
                    break;
                }
            }
        } catch (error) {
            if (error.code === 10007){
                klient.channels.fetch(configuration.administrationChannel)
                    .then(channel => {
                        channel.send(`:bangbang: \n${profile.nick_WT}${lang.MemberCheck.Squadron}${profile.clan}${lang.MemberCheck.DscNotFound}`)
                    })
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
    if(user.clearecnce === "developer"){
        return {success: true};
    }else if(allowedClearence.indexOf(user.clearecnce) != -1){
        return {success: true};
    }
    return {success: false};
}
export {DayActivity, squadronPoints, ProfileIniciation, brRangeTable, MemberCheck, membersPoints, passwordCheck, clearenceChech}
