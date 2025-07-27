#!/bin/bash

#environment setup
npm init -y
npm install ascii-table@0.0.9 axios@1.7.7 cheerio@1.0.0-rc.12 discord.js@14.21.0 diagnostics_channel@1.1.0 dotenv@16.4.5 express@4.19.2 mongodb@6.8.0
jq \
  --arg ver "1.0.1" \
  --arg type "module" \
  --arg main "src/index.js" \
  --arg description "WT-CW Discord Bot" \
  --arg author "Dik522"\
  '.version = $ver |
   .type = $type |
   .main = $main |
   .description = $description |
   .author = $author' package.json > package.temp.json && mv package.temp.json package.json

# creating .gitignore file
echo "Creating .gitignore file..."
cat > .gitignore <<EOF
/node_modules
.env
season.json
configuration.json
package-lock.json
package.json
EOF

# creating .env file
echo "Creating .env file..."
read -p "Insert discord bot TOKEN: " TOKEN
read -p "Insert Guild ID: " GUILD_ID
read -p "Insert Client (Bot) ID: " CLIENT_ID
read -p "Insert URI for MongoDB access: " URI

# save .env
cat > .env <<EOF
TOKEN=$TOKEN
GUILD_ID=$GUILD_ID
CLIENT_ID=$CLIENT_ID
URI=$URI
EOF

# configuration.json
echo "Creating configuration.json..."
read -p "Insert ID of channel for admin messages: " ADMIN_CHAN
read -p "Specify language dataset of bot (en/cz): " LANG

# Admins
ADMINS_JSON=""
while true; do
  read -p "Add new admin? (Person able to change configuration of bot) (Y/N): " ADD_ADMIN
  [[ $ADD_ADMIN =~ [nN] ]] && break

  read -p "Discord username of admin: " HOLDER
  read -p "Personal password: " PASSWORD
  read -p "Priviliege (high/developer/1,2,3,4) (developer can change anything in configuration.json, high can change values of any squadron, 1,2,3,4 can change only their own squadron): " CLEARENCE

  ADMIN_JSON="{\"holder\":\"$HOLDER\",\"password\":\"$PASSWORD\",\"clearence\":\"$CLEARENCE\"}"
  ADMINS_JSON="${ADMINS_JSON}${ADMIN_JSON},"
done
ADMINS_JSON="[${ADMINS_JSON%,}]"

# Funkce pro vytvoření JSON pro klan
create_clan_json() {
  local CLAN_NAME=$1
  read -p "Use (enable) this squadron? (true/false): " USED

  if [[ $USED == "true" ]]; then
    read -p "Squadron name (shortcut): " NAME
    read -p "Role ID of this squadron's role (discord role): " ROLE_ID
    read -p "Minimal CW points limit for standard player (integer): " STD_LIMIT
    read -p "Minimal CW points for sergeant (and higher) player (integer): " SGT_LIMIT
    read -p "WT URL of this squadron " URL
    read -p "Send daily total CW points of squadron? (true/false): " HEADER_OF
    [[ $HEADER_OF == "true" ]] && read -p "Channel ID to where send this 'header': " HEADER_CHAN
    read -p "Allow to record CW results? (true/false): " CW_ENTRY_OF
    [[ $CW_ENTRY_OF == "true" ]] && read -p "Channel ID to where send CW results: " CW_ENTRY_CHAN
    read -p "Allow to send summary of br when br changes? (true/false): " BR_INFO_OF
    [[ $BR_INFO_OF == "true" ]] && read -p "Channel ID to where send 'br info': " BR_INFO_CHAN
    read -p "Allow scraping to write down current squadron membersstats? (true/false): " SCRAPE_OF
    [[ $SCRAPE_OF == "true" ]] && read -p "Channel ID to where send 'scrape': " SCRAPE_CHAN
    read -p "Allow to send daily table of active players? (true/false): " ACTIVITY_OF
    [[ $ACTIVITY_OF == "true" ]] && read -p "Channel ID to where send daily activity table: " ACTIVITY_CHAN

    cat <<EOF
    "name":"$NAME",
    "RoleID":"$ROLE_ID",
    "standardLimit":$STD_LIMIT,
    "sergeantLimit":$SGT_LIMIT,
    "used":$USED,
    "URL":"$URL",
    "headerOF":$HEADER_OF,
    "headerChannel":"${HEADER_CHAN:-}",
    "CWEntryOF":$CW_ENTRY_OF,
    "CWentryChannel":"${CW_ENTRY_CHAN:-}",
    "brInfoOF":$BR_INFO_OF,
    "brInfoChannel":"${BR_INFO_CHAN:-}",
    "scrapeOF":$SCRAPE_OF,
    "scrapeChannel":"${SCRAPE_CHAN:-}",
    "activityOF":$ACTIVITY_OF,
    "activityChannel":"${ACTIVITY_CHAN:-}"
EOF
  else
    cat <<EOF
    "name":"",
    "RoleID":"",
    "standardLimit":0,
    "sergeantLimit":0,
    "used":false,
    "URL":"",
    "headerOF":false,
    "headerChannel":"",
    "CWEntryOF":false,
    "CWentryChannel":"",
    "brInfoOF":false,
    "brInfoChannel":"",
    "scrapeOF":false,
    "scrapeChannel":"",
    "activityOF":false,
    "activityChannel":""
EOF
  fi
}

# Generování JSON pro klany
CLANS_JSON=""
for CLAN in first second third fourth; do
  echo "Configuration of $CLAN squadron:"
  CLAN_JSON=$(create_clan_json $CLAN)
  CLANS_JSON="${CLANS_JSON}\"${CLAN}Clan\":{${CLAN_JSON}},"
done
CLANS_JSON="${CLANS_JSON%,}"

# Databázová konfigurace
read -p "Database name where CW results are to be stored: " DB_NAME_CW
read -p "Collection name where CW results are to be stored: " COLL_NAME_CW
read -p "Database name where players' profile shall be stored: " DB_NAME_PROFILE
read -p "Collection name where players' profile shall be stored: " COLL_NAME_PROFILE

# Aktivace
read -p "Hour (24h format) in which daily functions should be activated (time when CW are not enabled in your area - time after CW): " ACT_HOURS
read -p "Minutes in which daily functions should be activated: " ACT_MINUTES
read -p "Seconds in which daily functions should be activated: " ACT_SECONDS

# Uložení configuration.json
cat > configuration.json <<EOF
{
  "administrationChannel":"$ADMIN_CHAN",
  "language":"$LANG",
  "administrators":$ADMINS_JSON,
  $CLANS_JSON,
  "DBNames":{
    "CW":{
      "DB":"$DB_NAME_CW",
      "Collection":"$COLL_NAME_CW"
    },
    "Community":{
        "DB":"$DB_NAME_PROFILE",
        "Collection":"$COLL_NAME_PROFILE"
    }
  },
  "activation":{
    "hours":$ACT_HOURS,
    "minutes":$ACT_MINUTES,
    "seconds":$ACT_SECONDS
  }
}
EOF

echo "Configuration succesfully saved to src/"
