const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const endpoint_config = require('../../../endpoints.json');

const con = require('../../../database_con');
const query = util.promisify(con.query).bind(con);

const decoder = require('../../decoder');

const fs = require('fs')

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
    var painting = (req.body.painting) ? req.body.painting.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim() : "";

    //Metadata about post. Not needed in some games.
    var screenshot = (req.body.screenshot) ? req.body.screenshot : "";
    var app_data = (req.body.app_data) ? req.body.app_data.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim() : "";
    var screenshot = (req.body.screenshot) ? req.body.screenshot.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim() : "";
    var topic_tag = (req.body.topic_tag) ? req.body.topic_tag : "";
    var search_key = (req.body.search_key) ? req.body.search_key : "";
    var platform;

    //If no body or painting exists, what is there to post??
    if (!body && !painting) { res.sendStatus(400); return; }
    if (!feeling_id || !language_id || !community_id || !is_spoiler || !is_autopost || !is_app_jumpable) { res.sendStatus(400); return;}

    //Checking if the community id is 0, if it is, then get the community that shares the requests parampack title id.
    if (community_id == 0) {
        community_id = (await query('SELECT * FROM communities WHERE title_ids LIKE "%?%"', parseInt(req.param_pack.title_id)));

        //Checking if there is an avaliable community
        if (community_id.length == 0) { res.sendStatus(404); console.log("[ERROR] (%s) Community ID could not be found for title: %s.".red, moment().format("HH:mm:ss"), (Number(req.param_pack.title_id).toString(16))); return;}
        if (community_id[0].type == "announcement" && req.account[0].admin == 0) { res.sendStatus(503); console.log("[ERROR] (%s) %s tried to post to %s.".red, moment().format("HH:mm:ss"), req.account[0].nnid, community_id[0].name); return; }

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

    //Checking to see if the post is of the correct type for community
    var community_post_type = (await query("SELECT post_type FROM communities WHERE id=?", community_id))[0].post_type;

    if (community_post_type == "text" && painting) { res.sendStatus(400); return;}
    if (community_post_type == "memo" && body) { res.sendStatus(400); return;}

    //Create the post
    var result = await query(`INSERT INTO posts (account_id, ${(body) ? "body" : "painting"}, feeling_id, screenshot, title_id, search_key, spoiler, app_data, community_id, topic_tag, posted_from, language_id, pid, is_autopost, is_app_jumpable, country_id, region_id, platform_id) 
    VALUES(?, ?, ?, ?, ?, "${search_key}", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.account[0].id, ((body) ? body : painting), feeling_id, screenshot, parseInt(req.param_pack.title_id), is_spoiler, app_data, community_id, topic_tag, platform, language_id, req.account[0].pid, is_autopost, is_app_jumpable, req.param_pack.country_id, req.param_pack.region_id, req.param_pack.platform_id]);

    //TODO: if painting or screenshot, save a copy of either as .jpg in cdn

    if (painting && req.param_pack.platform_id == 1) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/paintings/${result.insertId}.png`, decoder.paintingProccess(painting), 'base64');
    } else if (painting && req.param_pack.platform_id == 0) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/paintings/${result.insertId}.bmp`, painting, 'base64');
    }

    if (screenshot) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/screenshots/${result.insertId}.jpg`, screenshot, 'base64');
    }

    res.status(404).redirect(`https://${endpoint_config.n3ds_url}/communities/${community_id}`);
    console.log("[INFO] (%s) Created New Post!".blue, moment().format("HH:mm:ss"));
})

route.post("/:post_id/empathies", async (req, res) => {
    const post_id = req.params.post_id;
    const current_yeah = (await query("SELECT * FROM empathies WHERE account_id=? AND post_id=?", [req.account[0].id, post_id]))[0];

    //Checking to see if the user has already yeah'd the post
    if (current_yeah) {
        //If the user has yeah'd, delete the empathy in the database for them
        await query("DELETE FROM empathies WHERE account_id=? AND post_id=?", [req.account[0].id, post_id]);

        //Once that is finished, send a 200 (OK) response
        //Also for portal and n3ds, send a json containing the result.
        res.status(200).send({result : "deleted"});
    } else {
        //If the user hasn't yeah'd, create an empathy in the database for them
        await query("INSERT INTO empathies (account_id, post_id) VALUES (?, ?)", [req.account[0].id, post_id]);

        //Once that is finished, send a 200 (OK) response
        //Also for portal and n3ds, send a json containing the result.
        res.status(200).send({result : "created"});
    }
})

module.exports = route;
