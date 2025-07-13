/**
 * Return structured string of tommorow date
 * @returns - string
 */
function tomorowsDate(){
    const dnes = new Date();
    let den;
    let mesic;
    if (dnes.getDate() < 10){den ="0"+ (dnes.getDate()+1)}else{den = (dnes.getDate()+1)}
    if ((dnes.getMonth()+1) < 10){mesic = "0"+ (dnes.getMonth()+1)}else{mesic = (dnes.getMonth()+1)}
    let dnesStrukturovane = (dnes.getFullYear()) + "-"+ (mesic)+"-"+(den);
    return dnesStrukturovane
}

/**
 * Returns structured string of today date
 * @returns  - string
 */
function actualDate(){
    const dnes = new Date();
    let den;
    let mesic;
    if (dnes.getDate() < 10){den ="0"+ (dnes.getDate())}else{den = (dnes.getDate())}
    if ((dnes.getMonth()+1) < 10){mesic = "0"+ (dnes.getMonth()+1)}else{mesic = (dnes.getMonth()+1)}
    let dnesStrukturovane = (dnes.getFullYear()) + "-"+ (mesic)+"-"+ (den);
    return dnesStrukturovane;
}

/**
 * Finds which br is played today.
 * @param {array} season - array of dates when br is changed and appropriate br
 * @returns - todays br
 */
function todaysbr(season){
    const todayDate = parseYMDToDate(actualDate());
    for (const obj of season) {
        if(obj.interval[0] === undefined || obj.interval[1] === undefined) return undefined;
        const start = parseYMDToDate(obj.interval[0]);
        const end = parseYMDToDate(obj.interval[1]);
        if (todayDate >= start && todayDate <= end) {
            return obj.value;
        }
    }
    return undefined;
}

function parseYMDToDate(dateString){
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
}

export {tomorowsDate, actualDate, todaysbr, parseYMDToDate}