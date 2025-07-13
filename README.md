# WT-CW-discord-bot
## About
Discord bot made for handling task around War Thunder clan wars. The bot can be used to send messages into discord channel containing structured results of CW battles and search results of battles for specific squadron. Te bot can also be used to post daily and br rangely message containing info about active players in that specified time interval (their name, change of squadron points or if they acomplished minimum limit of CW points (if given)). Bot can also monitor if  there are any changes to members of squadron (account left in game squadron or discord server, there is discrepency in roles). In future I would like to make statistics from CW results and add moderation options.
Bot can at this time comunicate in czech or english but another languages are easy to implement.

## Instalation
This bot requires node.js running environment. For informations how to install node.js refer to guide for your OS.  
Bot can be installed two ways using Git pull and by downloading a .zip.  
Git pull requires you to install git and sign in using github account but after that it is easy to do updates of app (discord bot).  
Using .zip doesn't require neither installing git nor having account there but it requires you to download every update and then extract files into the folder. It will always download whole program not only updated files.
### Git pull
Install git to your OS (for Linux sudo apt/dnf/pacman git (depending on your distribution), for Windows download it form official website). Open terminal and run git clone "URL" where URL is HTTPS share link acquired from website of this app. This will create folder of this app with appropriate files. You may be asked to sign in.  
When new version is avalaible just use git pull to update this app.
### Zip method
You need to download files as a .zip. Then you need to create a base folder for this app and extract all files into that folder.

## Setting up the app
After downloading app files you need to set up the application. You can use either prepared scripts that will help you with the setup or proceed to do manual setup. For both ways you need to be in the app folder (if you're not in there use "cd Path/to/AppFolder/") .
### Set up scripts
In order to be able to use the script you need to allow it first.  
For Linux you need to install one more app in orded to have fully working script: "sudo apt install jq" then run "chmod +x ./setup.sh" followed by "./setup.sh"  
For Windows you need to run "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass" followed by".\setup.ps1".  
These scripts will lead you by setup process.  
In order to be able to fill in right data you need to create a discord bot using discord developer portal and create cloud mongo database and copy (and edit as specified) URL access to the database.  
After you finish with the script then you need one more thing and that is to run "node ./src/register-commands.js" to register slash commands for this app.
### Manual set up
You need to initialise npm (nmp init) in the main script field you need to insert "src/index-tb.js" and after finishing initialisation of npm you need to add " "type":"module" "   into the file. After that you need to type in following:  
- nmp install ascii-table@0.0.9
- npm install axios@1.7.7
- npm install cheerio@1.0.0-rc.12
- npm install discord.js@14.14.1
- npm install dotenv@16.4.5
- npm install express@4.19.2
- npm install mongodb@6.8.0

Then you need to fill in .env-temp and configuration-template.json and then remove the temp/-template from their names.  
Last thing you need to run "node ./src/register-commands.js" to register slash commands for this app.  
## Abilities
Bot can send daily information about members whose cw points have changed. Bot can also send table of members who played CW during last br range and detect if member has wrong role, or left discord server or clan. In orded to use these functions you need to create profile of every member. This app can be also used to write down (and edit) results of cw battles into clear format. It is also suggested to inpot cw season data into this app so it can be included into database.
### Profile creation
First of all you need to create profile for each member of your clan (both existing and new in a future) by typing _/ini_ and choosing initialise profile command from this app (name will depend based on your language settings). In here you need to:
- _insert WT nickname_ of member from your clan website (go to warthunder.com -> community -> search player, insert name of player in your squadron and click on name of squadron next to profile picture of that player) nickname must be __exact as written on this site__ (console players have different name in game and on website)
- _discordID_ is ID of discord account of member whose profile is created. To get ID you need to right click member and select copy user ID (lowes option) but you may need to turn on developer mode first (go to **app setting**-> advanced and turn on developer mode)
- _clan_ shortcut (as shown ingame or on website - max 5 symbols) without special characters (dots, lions swords etc.) into which member is being accepted
- _comments_ about that member, if no comments are neede input - (or something else as some input is required)
### CR entries
To input results of CW battle use _/cw_ (or something in this regard based on your language setting). You need to fill in following:
- _result_ of givven battle being win or loss
- _clan_ which was your opponent in that battle (again only anphanumerical shortcut - without special characters)
- _planes_ needs number of enemy __planes__ in that battle
- _helicopters_ represent number of helicopters in given battle
- _aa_ is number of aa in enemy team
- _tanks_ is number of enemy tanks
- _reprezentative_ is true/false option. Choose false if the battle wasn't in standard way (server hamster died, enemy/ally player didn't join etc.) other way choose true. This option decides if the result will be used into statistics.
- _comments_ is filed for comments to battle if needed (can be specified is airspawn had occured, special vehicles (2S38, UFO,...))  
Sum of enemy vehicles must give 8 or else error message will be returned stating that sum isn't 8.

_/edit_ (simmilar to this) is used to edit last line of cw result you are writing in. Fields are the same as in _/cw_.

_/delete_ (or simmilar) is used to delete last line of cw result you are writing. There are no filds in this command.

### Inputing season data
__/Season_br__ is used to input season brs into this app. You need to input all br which will be played this season in descenting order (in order in which they'll be played).  
__/season_dates__ is used to input starting date of season, dates in which br is changed (specifically dates which **are last for their br interval** - next day will be different br) and ending date of CW season.

### Editing app setting trough discord
**/config...** can be used to switch function per clan and also to alter discord channel into which are results of those functions send to. You need to insert:
- your password givven by admin of this app (someone who has acces to **files of this app**)
- choose for which clan you want to make the change
- and next you need to choose if you want to switch a function (or whole clan) or change result sending channel
   - swithcing on/off a function
      - *switch_function* is used to select which function you want to switch
         - _use_ to switch whole clan (1, 2, 3 or 4)
         - _squadron points_ to switch send message with total CW points of squadron
         - _active player_ to switch sending daily message of players active in that day
         - _Scrape_ to switch text command to scrape current state of squadron into message (this is backup option as it sends one message for each member)
         - _CW results_ to switch commands for writing down CW results
         - _br range results_ to switch function sending a table of players active in br range at it's end
      - *switch_on_off* is used to either turn on or off givven function
   - changing channel to send info into
      - *function_channel* to specify which send channel will be changed (administration channel is channel where info about bot and warnings are send - possible to change only by admin of app or someone with developer clearence password)
      - *channel_id* to input ID of channel where should be messages send from now on
## Forking and pull requests
Feel free to fork your own version of this app and hopefully after making changes to your own liking publish your code or even place pull request.

## Licencing
This app is under AGPL-3.0 license. Important note is that this app was/is created as free and monetizing this app isn't what I had in mind when this was created. Adding way to support (voluntarily) a developer/hardware - hosting isn't considered monetization in this case.

## Contact
If you want to contact me you can do so either using discord (if you happend to be on the same server) - dik522 (account name), Dik522 (usually server name)
or using email: Dik522@proton.me