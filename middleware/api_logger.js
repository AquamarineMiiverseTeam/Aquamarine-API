const db_con = require('../../shared_config/database_con');

async function log_api_usage(req, res, next) {
    var account_id;
    if (req.account && req.account.length > 0) account_id = req.account[0].id;
    else account_id = null;

    //Make sure not to await this action. This is just so the request goes by faster, as the
    //API logging isn't too neccesary for the request to be made.
    await db_con.env_db("api_calls").insert({
        url: req.path,
        query: req.query,
        account_id: account_id,
        platform_id: req.param_pack.platform_id,
        rating_organization: req.param_pack.rating_organization,
        transferable_id: String(req.param_pack.transferable_id),
        title_id: (parseInt(req.param_pack.title_id)).toString(16),
        region_id: req.param_pack.region_id,
        language_id: req.param_pack.language_id,
        tz_name: req.param_pack.tz_name,
        area_id: req.param_pack.area_id
    })

    next();
}

module.exports = log_api_usage
