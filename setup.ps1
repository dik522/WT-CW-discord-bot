# Environment setup for WT-CW Discord Bot
npm init -y
npm install ascii-table@0.0.9 axios@1.7.7 cheerio@1.0.0-rc.12 discord.js@14.14.1 diagnostics_channel@1.1.0 dotenv@16.4.5 express@4.19.2 mongodb@6.8.0
$json = Get-Content package.json | ConvertFrom-Json
$json.type = "module"
$json.version = "1.0.0"
$json.main = "src/index.js"
$json.author = "Dik522"
$json | ConvertTo-Json -Depth 10 | Set-Content package.json

#Creating .gitignore
@"
.env
/node_modules
season.json
configuration.json
package-lock.json
package.json
"@ | Out-File -FilePath ".gitignore" -Encoding utf8

# Dotazy pro /.env
Write-Host "Creating .env file..."
$TOKEN = Read-Host "Insert discord bot TOKEN"
$GUILD_ID = Read-Host "Insert Guild ID"
$CLIENT_ID = Read-Host "Insert Client (Bot) ID"
$URI = Read-Host "Insert URI for MongoDB access"

# Uložení .env
@"
TOKEN=$TOKEN
GUILD_ID=$GUILD_ID
CLIENT_ID=$CLIENT_ID
URI=$URI
"@ | Out-File -FilePath ".env" -Encoding utf8

# Dotazy pro configuration.json
Write-Host "Creating configuration.json..."
$ADMIN_CHAN = Read-Host "Insert ID of channel for admin messages"
$LANG = Read-Host "Specify language dataset of bot (en/cz)"

# Administrátoři
$admins = @()
do {
    $addAdmin = Read-Host "Add new admin? (Person able to change configuration of bot) (Y/N)"
    if ($addAdmin -eq "Y" -or $addAdmin -eq "y") {
        $holder = Read-Host "Discord username of admin"
        $password = Read-Host "Personal password"
        $clearence = Read-Host "Priviliege (high/developer/1,2,3,4) (developer can change anything in configuration.json, high can change values of any squadron, 1,2,3,4 can change only their own squadron)"
        
        $admins += @{ holder = $holder; password = $password; clearence = $clearence }
    }
} while ($addAdmin -eq "Y" -or $addAdmin -eq "y")

# Funkce pro vytvoření klanu
function Get-ClanConfig {
    param($clanName)
    Write-Host "Configuration of $clanName squadron:"
    $used = Read-Host "Use (enable) this squadron? (true/false)"
    
    if ($used -eq "true") {
        $name = Read-Host "Squadron name (shortcut)"
        $roleId = Read-Host "Role ID of this squadron's role (discord role)"
        $stdLimit = Read-Host "Minimal CW points limit for standard player (integer)"
        $sgtLimit = Read-Host "Minimal CW points for sergeant (and higher) player (integer)"
        $url = Read-Host "WT URL of this squadron"
        $headerOF = Read-Host "Send daily total CW points of squadron? (true/false)"
        $headerChan = if ($headerOF -eq "true") { Read-Host "Channel ID to where send this 'header'" } else { "" }
        $cwEntryOF = Read-Host "Allow to record CW results? (true/false)"
        $cwEntryChan = if ($cwEntryOF -eq "true") { Read-Host "Channel ID to where send CW results" } else { "" }
        $brInfoOF = Read-Host "Allow to send summary of br when br changes? (true/false)"
        $brInfoChan = if ($brInfoOF -eq "true") { Read-Host "Channel ID to where send 'br info'" } else { "" }
        $scrapeOF = Read-Host "Allow scraping to write down current squadron members stats? (true/false)"
        $scrapeChan = if ($scrapeOF -eq "true") { Read-Host "Channel ID to where send 'scrape'" } else { "" }
        $activityOF = Read-Host "Allow to send daily table of active players? (true/false)"
        $activityChan = if ($activityOF -eq "true") { Read-Host "Channel ID to where send daily activity table" } else { "" }

        @{
            name = $name
            RoleID = $roleId
            standardLimit = [int]$stdLimit
            sergeantLimit = [int]$sgtLimit
            used = $true
            URL = $url
            headerOF = [bool]::Parse($headerOF)
            headerChannel = $headerChan
            CWEntryOF = [bool]::Parse($cwEntryOF)
            CWentryChannel = $cwEntryChan
            brInfoOF = [bool]::Parse($brInfoOF)
            brInfoChannel = $brInfoChan
            scrapeOF = [bool]::Parse($scrapeOF)
            scrapeChannel = $scrapeChan
            activityOF = [bool]::Parse($activityOF)
            activityChannel = $activityChan
        }
    } else {
        @{
            name = ""
            RoleID = ""
            standardLimit = 0
            sergeantLimit = 0
            used = $false
            URL = ""
            headerOF = $false
            headerChannel = ""
            CWEntryOF = $false
            CWentryChannel = ""
            brInfoOF = $false
            brInfoChannel = ""
            scrapeOF = $false
            scrapeChannel = ""
            activityOF = $false
            activityChannel = ""
        }
    }
}

# Konfigurace klanů
$clans = @{
    firstClan = Get-ClanConfig "first"
    secondClan = Get-ClanConfig "second"
    thirdClan = Get-ClanConfig "third"
    fourthClan = Get-ClanConfig "fourth"
}

# Databázová konfigurace
$dbNameCW = Read-Host "Database name where CW results are to be stored"
$collNameCW = Read-Host "Collection name where CW results are to be stored"
$dbNameCommunity = Read-Host "Database name where community data are to be stored"
$collNameCommunity = Read-Host "Collection name where community data are to be stored"

# Aktivace
$hours = Read-Host "Hour (24h format) in which daily functions should be activated (time when CW are not enabled in your area - time after CW)"
$minutes = Read-Host "Minutes in which daily functions should be activated"
$seconds = Read-Host "Seconds in which daily functions should be activated"

# Sestavení a uložení JSON
$config = @{
    administrationChannel = $ADMIN_CHAN
    language = $LANG
    administrators = $admins
    firstClan = $clans.firstClan
    secondClan = $clans.secondClan
    thirdClan = $clans.thirdClan
    fourthClan = $clans.fourthClan
    DBNames = @{
        CW = @{
            DB = $dbNameCW
            Collection = $collNameCW
        }
        Community = @{
            DB = $dbNameCommunity
            Collection = $collNameCommunity
        }
    }
    activation = @{
        hours = [int]$hours
        minutes = [int]$minutes
        seconds = [int]$seconds
    }
}

$config | ConvertTo-Json -Depth 10 | Out-File -FilePath "configuration.json" -Encoding utf8
Write-Host "Configuration successfully saved to src\"