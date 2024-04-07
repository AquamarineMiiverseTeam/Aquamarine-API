const express = require('express');
const route = express.Router();
const bodyParser = require("body-parser")

const logger = require('../../middleware/log');
const db_con = require('../../../shared_config/database_con');

route.post("/:community_id/posts", bodyParser.json(), async (req, res) => {
    const community_id = req.params.community_id;
    const feeling_id = req.body.feeling_id;
    const spoiler = req.body.spoiler;
    const title_owned = req.body.title_owned;

    const topic_tag = req.body.topic_tag;
    const body = req.body.body;
    const painting = req.body.painting;
    const screenshot = req.body.screenshot;
    var platform;

    if (!title_owned || !spoiler || !feeling_id || !community_id) {
        logger.error(`No title_owned, spoiler, feeling_id, or community_id from ${req.account[0].nnid}`);
        res.status(400).send({result : "failure", error : "Missing values. Abusing API is prohibited."});
        return;
    }
    if (!body && !painting) {
        logger.error(`No painting for body from ${req.account[0].nnid}`);
        res.status(400).send({result : "failure", error : "No body or painting was supplied. Abusing API is prohibited."});
        return;
    }

    const community = (await db_con.env_db("communities").where({id : community_id}))[0]

    if (community.post_type == "text" && painting) { res.sendStatus(400); logger.error("Text only community!"); return;}
    if (community.post_type == "memo" && body) { res.sendStatus(400); logger.error("Memo only community!"); return;}
    if (community.type == "announcement" && req.account[0].admin == 0) { res.sendStatus(503); logger.error(`${req.account[0].nnid} tried to post to ${community.name}`); return; }

    switch (parseInt(req.param_pack.platform_id)) {
        case 0:
            platform = "3ds";
            break;
        case 1:
            platform = "wiiu";
            break;
        default:
            platform = "none";
            break;
    }

    const insert_data = {
        country_id : req.param_pack.country_id,
        region_id : req.param_pack.region_id,
        title_id : req.param_pack.title_id, 
        platform_id : req.param_pack.platform_id,
        language_id : req.param_pack.language_id,

        account_id : req.account[0].id,
        pid : req.account[0].pid,
        
        feeling_id : feeling_id,
        community_id : community_id,
        spoiler : spoiler,

        is_autopost : 0,
        is_app_jumpable : 0,
        
    }
})

module.exports = route