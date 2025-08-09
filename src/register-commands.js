import dotenv from "dotenv";
dotenv.config();
import { REST, Routes, ApplicationCommandOptionType} from 'discord.js';

const commands = [
    {
        name: "view_profile",
        name_localizations: {"cs":"zobrazeni_profilu"},
        description: "Returns data from specified member's profile",
        description_localizations: {"cs": "Zobrazí data profilu specifikovaného uživatele"},
        options: [
            {
                name: "password",
                name_localizations: {"cs": "heslo"},
                description: "personal password of leadership members",
                description_localizations: {"cs": "pro vložení osobního hesla členů vedení"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 6,
                max_length: 14
            },{
                name: "member",
                name_localizations: {"cs": "clen"},
                description: "member whose profile shall be shown",
                description_localizations: {"cs": "člen jehož profil má být zobrazen"},
                type: ApplicationCommandOptionType.String,
                required: true,
            }
        ]
    },{
        name: "init_profile",
        name_localizations:{"cs":"iniciaceprofilu"},
        description: "Initialise profile of new member",
        description_localizations:{"cs": "Provede iniciaci profilu DB nového člena"},
        options: [
            {
                name: "nickwt",
                description: "WT nickname of new member",
                description_localizations:{"cs": "WT nick nového clena"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 3,
                max_length: 20
            },{
                name: "discordid",
                description: "Discord ID of new member",
                description_localizations:{"cs": "ID discord účtu nového člena"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 17,
                max_length: 19
            },{
                name: "squadron",
                name_localizations:{"cs":"svaz"},
                description: "Squadron of new member",
                description_localizations: {"cs":"Zkratka svazu, do něhož byl přijat"},
                type:ApplicationCommandOptionType.String,
                required: true,
                min_length: 1,
                max_length: 5
            },{
                name: "comments",
                name_localizations:{"cs":"poznamky"},
                description: "Comments of new member",
                description_localizations:{"cs": "poznámky k členovi"},
                type:ApplicationCommandOptionType.String,
                required: true,
                min_length: 1,
                max_length: 100
            }
        ]
    },
    {
        name: "cw_entry",
        name_localizations:{"cs":"cw_zapis"},
        description: "Write CW result",
        description_localizations: {"cs":"Provede zápis výsledku bitvy"},
        options: [
            {
                name: "result",
                name_localizations:{"cs":"vysledek"},
                description: "Result of battle",
                description_localizations: {"cs":"Jak dopadla bitva"},
                type: ApplicationCommandOptionType.String,
                required: true,
                choices:
                [
                    {
                        name: "win",
                        name_localizations:{"cs":"vyhra"},
                        value: "+",
                    },
                    {
                        name:"loss",
                        name_localizations:{"cs":"prohra"},
                        value: "-",
                    }
                ],
            },
            {
                name: "squadron",
                name_localizations:{"cs":"svaz"},
                description: "Name of opposite squadron",
                description_localizations: {"cs":"název klanu, proti kterému se hrálo"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 1,
                max_length: 5
            },
            {
                name: "planes",
                name_localizations:{"cs":"letadla"},
                description: "Number of enemy planes in battle",
                description_localizations: {"cs":"počet letadel v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"helicopters",
                name_localizations:{"cs":"helikoptery"},
                description: "Number of enemy helicopters in battle",
                description_localizations: {"cs":"počet helikoptér v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"aa",
                name_localizations:{"cs":"aačka"},
                description: "Number of enemy AA in battle",
                description_localizations: {"cs":"počet AAček v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name: "tanks",
                name_localizations:{"cs":"tanky"},
                description: "Number of enemy tanks in battle",
                description_localizations: {"cs":"počet tanků v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"reprezentative",
                name_localizations:{"cs":"reprezentativní"},
                description: "Was battle reprezentative?",
                description_localizations: {"cs":"Byla bitva reprezentativní?"},
                type:ApplicationCommandOptionType.Boolean,
                required: true,
                choices:[
                    {
                        name:"yes",
                        name_localizations:{"cs":"ano"},
                        value: true,
                    },
                    {
                        name: "no",
                        name_localizations:{"cs":"ne"},
                        value: false,
                    }
                ]
            },
            {
                name: "comments",
                name_localizations:{"cs":"poznamky"},
                description: "Comments to battle (specific vehicles etc.)",
                description_localizations: {"cs":"Místo pro poznámky (specifické stroje atd.)"},
                type: ApplicationCommandOptionType.String,
                required: false,
                min_length: 0,
                max_length: 100
            }
        ]
    },
    {
        name: "cw_delete",
        name_localizations:{"cs":"smazani_posledniho_zaznamu_cw"},
        description: "Delete last CW entry",
        description_localizations: {"cs":"Smaže poslední záznam cw"}
    },{
        name: "cw_edit",
        name_localizations:{"cs":"uprava_zápisu_cw"},
        description: "Edits last CW entry",
        description_localizations: {"cs":"Provede úpravu posledního zápisu cw"},
        options: [
            {
                name: "result",
                name_localizations:{"cs":"vysledek"},
                description: "Result of battle",
                description_localizations: {"cs":"Jak dopadla bitva"},
                type: ApplicationCommandOptionType.String,
                required: true,
                choices:
                [
                    {
                        name: "win",
                        name_localizations:{"cs":"vyhra"},
                        value: "+",
                    },
                    {
                        name:"loss",
                        name_localizations:{"cs":"prohra"},
                        value: "-",
                    }
                ],
            },
            {
                name: "squadron",
                name_localizations:{"cs":"svaz"},
                description: "Name of opposite squadron",
                description_localizations: {"cs":"název klanu, proti kterému se hrálo"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 1,
                max_length: 5
            },
            {
                name: "planes",
                name_localizations:{"cs":"letadla"},
                description: "Number of enemy planes in battle",
                description_localizations: {"cs":"počet letadel v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"helicopters",
                name_localizations:{"cs":"helikoptery"},
                description: "Number of enemy helicopters in battle",
                description_localizations: {"cs":"počet helikoptér v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"aa",
                name_localizations:{"cs":"aačka"},
                description: "Number of enemy AA in battle",
                description_localizations: {"cs":"počet AAček v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name: "tanks",
                name_localizations:{"cs":"tanky"},
                description: "Number of enemy tanks in battle",
                description_localizations: {"cs":"počet tanků v bitvě"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name:"reprezentative",
                name_localizations:{"cs":"reprezentativní"},
                description: "Was battle reprezentative?",
                description_localizations: {"cs":"Byla bitva reprezentativní?"},
                type:ApplicationCommandOptionType.Boolean,
                required: true,
                choices:[
                    {
                        name:"yes",
                        name_localizations:{"cs":"ano"},
                        value: true,
                    },
                    {
                        name: "no",
                        name_localizations:{"cs":"ne"},
                        value: false,
                    }
                ]
            },
            {
                name: "comments",
                name_localizations:{"cs":"poznamky"},
                description: "Comments to battle (specific vehicles etc.)",
                description_localizations: {"cs":"Místo pro poznámky (specifické stroje atd.)"},
                type: ApplicationCommandOptionType.String,
                required: false,
                min_length: 0,
                max_length: 100
            }
        ]
    },
    {
        name:"season-br",
        name_localizations:{"cs":"sezona_br"},
        description: "to save season brs",
        description_localizations: {"cs":"provede zápis dat o br nové sezóny"},
        options:[
            {
                name: "br1",
                description: "highest br",
                description_localizations: {"cs":"nejvyšší br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name: "br2",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br3",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br4",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br5",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br6",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br7",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "br8",
                description: "next br",
                description_localizations: {"cs":"další br"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            },{
                name: "season_end",
                name_localizations:{"cs":"konec_sezony"},
                description: "lowest br of season",
                description_localizations: {"cs":"konečné br (nejnižší)"},
                type: ApplicationCommandOptionType.Number,
                required: true,
            }
        ]
    },
    {
        name:"configuration_change",
        name_localizations:{"cs":"uprava_konfigurace"},
        description: "does change configuration of the bot",
        description_localizations:{"cs":"upravuje konfigurace bota"},
        options:[
            {
                name:"password",
                name_localizations:{"cs":"heslo"},
                description:"enter your password",
                description_localizations:{"cs":"zadejte heslo"},
                type:ApplicationCommandOptionType.String,
                required:true
            },{
                name: "clan",
                name_localizations:{"cs":"svaz"},
                description: "choose clan to change it's configuration",
                description_localizations:{"cs":"vyberte svaz pro který je změna konfigurace"},
                type:ApplicationCommandOptionType.String,
                required: true,
                choices:
                [
                    {
                        name:"1",
                        value: "1"
                    },{
                        name:"2",
                        value: "2"
                    },{
                        name:"3",
                        value: "3"
                    },{
                        name:"4",
                        value: "4"
                    }
                ]
            },{
                name: "switch_function",
                name_localizations:{"cs":"zapnuti_vypnuti_funkce"},
                description: "choose to switch functions",
                description_localizations:{"cs":"vyberte pro zvolení funkce k vypnutí/zapnutí"},
                type:ApplicationCommandOptionType.String,
                required: false,
                choices:
                [
                    {
                        name: "use",
                        name_localizations:{"cs":"pouzit"},
                        value:"used"
                    },{
                        name:"squadron points",
                        name_localizations:{"cs":"body svazu"},
                        value: "headerOF"
                    },{
                        name:"active players",
                        name_localizations:{"cs":"aktivní hráči"},
                        value: "activityOF"
                    },{
                        name:"Scrape",
                        name_localizations:{"cs":"scrape"},
                        value:"scrapeOF"
                    },{
                        name: "CW results",
                        name_localizations:{"cs":"cw zápis"},
                        value:"CWEntryOF"
                    },{
                        name:"br range results",
                        name_localizations:{"cs":"týdenní info"},
                        value:"brInfoOF"
                    }
                ]
            },{
                name:"switch_on_off",
                name_localizations:{"cs":"prepnuti_funkce"},
                description:"to turn on and off specified function",
                description_localizations:{"cs":"pro zapnutí/zapnutí fce"},
                type: ApplicationCommandOptionType.Boolean,
                required:false,
                choices:
                [
                    {
                        name:"turn on",
                        name_localizations:{"cs":"zapnout"},
                        value: true
                    },{
                        name:"turn off",
                        name_localizations:{"cs":"vypnout"},
                        value: false
                    }
                ]
            },{
                name:"function_channel",
                name_localizations:{"cs":"nastaveni_kanalu"},
                description:"choose function to have changed it's channel",
                description_localizations:{"cs":"vyberte kanály pro výstup bota"},
                type:ApplicationCommandOptionType.String,
                required:false,
                choices:
                [
                    {
                        name: "CW Results",
                        name_localizations:{"cs":"cw výsledky"},
                        value: "CWEntryChannel"
                    },{
                        name:"today's active players",
                        name_localizations:{"cs":"aktivní hráči"},
                        value: "activityChannel"
                    },{
                        name:"Squadron points",
                        name_localizations:{"cs":"body svazu"},
                        value: "headerChannel"
                    },{
                        name:"br range info",
                        name_localizations:{"cs":"týdenní info"},
                        value: "brInfoChannel"
                    },{
                        name:"Scrape",
                        name_localizations:{"cs":"scrape"},
                        value: "scrapeChannel"
                    },{
                        name:"administration channel",
                        name_localizations:{"cs":"vývojové info"},
                        value: "administrationChannel"
                    }
                ]
            },{
                name:"channel_id",
                name_localizations:{"cs":"id_kanálu"},
                description:"input ID of channel where should specified function post",
                description_localizations:{"cs":"pro zadání ID kanálu k odesílání"},
                type: ApplicationCommandOptionType.String,
                required: false,
                min_length: 17,
                max_length: 19
            }
        ]
    },{
        name:"season_dates",
        name_localizations:{"cs":"sezona_datumy"},
        description: "to save season dates when br changes, format XXXX-XX-XX",
        description_localizations:{"cs": "provede zápis datumů, kdy dochází ke změně br nové sezóny, formát XXXX-XX-XX"},
        options:[
            {
                name: "season_start",
                name_localizations:{"cs":"zacatek_sezony"},
                description: "date of start of new season",
                description_localizations:{"cs": "datum kdy zacala nová sezóny"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date1",
                name_localizations:{"cs":"datum1"},
                description: "end date of toptier",
                description_localizations: {"cs":"datum kdy končí nejvyšší br"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date2",
                name_localizations: {"cs": "datum2"},
                description: "end date of next br",
                description_localizations: {"cs":"datum kdy končí další br"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date3",
                name_localizations: {"cs": "datum3"},
                description: "end date of 3rd br",
                description_localizations: {"cs":"datum kdy končí 3. br"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date4",
                name_localizations:{"cs":"datum4"},
                description: "end date of 4th br",
                description_localizations: {"cs":"datum kdy končí 4. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date5",
                name_localizations: {"cs":"datum5"},
                description: "end date of 5th br",
                description_localizations: {"cs":"datum kdy končí 5. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date6",
                name_localizations: {"cs":"datum6"},
                description: "end date of 6th br",
                description_localizations: {"cs":"datum kdy končí 6. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date7",
                name_localizations: {"cs":"datum7"},
                description: "end date of 7th br",
                description_localizations: {"cs":"datum kdy končí 7. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "date8",
                name_localizations: {"cs":"datum8"},
                description: "end date of 8th br",
                description_localizations: {"cs":"datum kdy končí 8. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            },{
                name: "season_end",
                name_localizations: {"cs":"konec_sezony"},
                description: "end date of 9th br",
                description_localizations: {"cs":"datum kdy končí 9. br sezony"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 10,
                max_length: 10
            }
        ]
    },{
        name:"evidence",
        description: "add yourself as a logger for someone else",
        description_localizations: {"cs":"provede zaevdování jako editora výsledků jiné osoby"},
        options:[
            {
                name:"user",
                name_localizations:{"cs":"uzivatel"},
                type: ApplicationCommandOptionType.String,
                required: true,
                description:"input name of user to became his logger",
                description_localizations:{"cs":"Zadejte jméno uživatele, jehož výsledky chcete upravovat"},
                min_length: 1,
                max_length: 20
            }
        ]
    },{
        name:"squadron_search",
        name_localizations:{"cs":"hledej_svaz"},
        description: "search all records for specific squadron",
        description_localizations: {"cs":"vyhledá všechny záznamy pro daný svaz"},
        options:[
            {
                name: "squadron",
                name_localizations: {"cs":"svaz"},
                description: "name of squadron",
                description_localizations: {"cs":"název svazu"},
                type: ApplicationCommandOptionType.String,
                required: true,
                min_length: 1,
                max_length: 5
            }
        ]
    },{
        name:"unban_member",
        description: "Unban a member using WTCW bot",
        description_localizations: {"cs":"Zrušit banování člena pomocí WTCW bota"},
        options:[
            {
                name: "user_id",
                name_localizations: {"cs":"uzivatel_id"},
                description: "ID of the user to unban",
                description_localizations: {"cs":"ID uživatele, jemuž chcete zrušit ban"},
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    }
];

const rest = new REST({version: "10"}).setToken(process.env.TOKEN);

(async ()=> {
    try{
        console.log("Registering slash commands");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
                ),
            { body: commands }
        );

        console.log("Slash commands registered!");
    }catch(error){
        console.log(`!!!Error here: ${error}`);
    }
})();