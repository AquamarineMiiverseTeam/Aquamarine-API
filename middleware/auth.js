const colors = require('colors');
const xmlbuilder = require('xmlbuilder');
const moment = require('moment');
const util = require('util')

const con = require('../database_con');
const query = util.promisify(con.query).bind(con);

async function auth(req, res, next) {

    //Assigning variables
    var param_pack = req.get('x-nintendo-parampack');
    var service_token = req.get('x-nintendo-servicetoken').slice(0, 42);

    //Check if the request is faulty or not.
    if (!service_token || !param_pack) { res.sendStatus(401); console.log("[ERROR] (%s) Recieved either no Param Pack or no Service Token.".red, moment().format("HH:mm:ss")); return;}

    //Translating Param_Pack into a more readable format to collect data from.
    var base64Result = (Buffer.from(param_pack, 'base64').toString()).slice(1, -1).split("\\");
    req.param_pack = {}

    for (let i = 0; i < base64Result.length; i += 2) {
        req.param_pack[base64Result[i].trim()] = base64Result[i + 1].trim();
    }

    //TODO: add proper account auth when we make the users table in the database

    //Grabbing the correct service token
    var sql;
    switch (parseInt(req.param_pack.platform_id)) {
        case 0:
            sql = "SELECT * FROM accounts WHERE 3ds_service_token = ?";
            break;
        case 1:
            sql = "SELECT * FROM accounts WHERE wiiu_service_token = ?";
            break;
        default:
            sql = "SELECT * FROM accounts WHERE wiiu_service_token = ?";
            break;
    }

    console.log(sql);

    var account = await query(sql, service_token);
    
    //If there is no account, then send a 401 (Unauthorized)
    if (account.length == 0) {res.sendStatus(401); return;}

    //Finally, set the requests account to be the newly found account from the database
    req.account = account

    console.log(account)

    next();
}

module.exports = auth