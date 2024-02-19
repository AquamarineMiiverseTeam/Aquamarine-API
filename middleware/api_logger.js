const db_con = require('../../Aquamarine-Utils/database_con');

async function log_api_usage(req, res, next) {
    var account_id;
    if (req.account && req.account.length > 0) account_id = req.account[0].id;
    else account_id = null;

    //Make sure not to await this action. This is just so the request goes by faster, as the
    //API logging isn't too neccesary for the request to be made.
    await db_con("api_calls").insert({
        url: req.path,
        query: req.query,
        account_id: account_id
    })

    next();
}

module.exports = log_api_usage