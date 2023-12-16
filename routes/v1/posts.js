const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer')

const con = require('../../database_con');
const query = util.promisify(con.query).bind(con);

route.post("/", multer().none(), async (req, res) => {

    //Important variables. Won't continue posting if these variables arn't there.
    var feeling_id = req.body.feeling_id;
    var language_id = req.body.language_id;
    var community_id = req.body.community_id;    
    var is_spoiler = req.body.is_spoiler;
    var is_autopost = req.body.is_autopost;
    var is_app_jumpable = req.body.is_app_jumpable;

    //Less important variables, will only need a body or painting to continue.
    var body = (req.body.body) ? req.body.body : "";
    var painting = (req.body.painting) ? req.body.painting : "";

    //Metadata about post. Not needed in some games.
    var screenshot = (req.body.screenshot) ? req.body.screenshot : "";
    var app_data = (req.body.app_data) ? req.body.app_data : "";
    var screenshot = (req.body.screenshot) ? req.body.screenshot : "";
    var topic_tag = (req.body.topic_tag) ? req.body.topic_tag : "";
    var search_key = (req.body.search_key) ? req.body.search_key : "";
    var platform;

    //If no body or painting exists, what is there to post??
    if (!body && !painting) { res.sendStatus(400); return; }
    if (!feeling_id && !language_id && !community_id && !is_spoiler && !is_autopost && !is_app_jumpable) { res.sendStatus(400); return;}

    //Checking if the community id is 0, if it is, then get the community that shares the requests parampack title id.
    if (community_id == 0) {
        community_id = (await query('SELECT id FROM communities WHERE title_ids LIKE "%?%"', parseInt(req.param_pack.title_id)));
        
        //Checking if there is an avaliable community
        if (community_id.length == 0) { res.sendStatus(404); return;}

        community_id = community_id[0]['id'];
    }

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

    //TODO: add in account_id's to show which posts are owned by which accounts.
    var current_time = (await query("SELECT NOW()"))[0]['NOW()'];

    //Create the post
    var result = await query(`INSERT INTO posts (account_id, create_time, ${(body) ? "body" : "painting"}, feeling_id, screenshot, title_id, search_key, spoiler, app_data, community_id, topic_tag, posted_from, language_id) 
    VALUES(?, ?, ?, ?, ?, ?, "${search_key}", ?, ?, ?, ?, ?, ?)`, [req.account[0].id, current_time, ((body) ? body : painting), feeling_id, screenshot, parseInt(req.param_pack.title_id), is_spoiler, app_data, community_id, topic_tag, platform, language_id]);

    //TODO: if painting or screenshot, save a copy of either as .jpg in cdn

    res.sendStatus(200);

    console.log("Created New Post!".blue)
})

module.exports = route;
