const express = require('express');
const route = express.Router();

const multer = require('multer');
const moment = require('moment');

const decoder = require('../../utility/decoder');

const fs = require('fs');

const logger = require('../../middleware/log');
const db_con = require('../../../shared_config/database_con');

const cdn_upload = require("../../utility/cdn_upload")

route.post("/", multer().none(), async (req, res) => {
    //Important variables. Won't continue posting if these variables arn't there.
    const feeling_id = req.body.feeling_id;
    const language_id = req.body.language_id;
    var community_id = req.body.community_id;    
    const is_spoiler = req.body.is_spoiler;
    const is_autopost = req.body.is_autopost;
    const is_app_jumpable = req.body.is_app_jumpable;

    //Less important variables, will only need a body or painting to continue.
    const body = (req.body.body) ? req.body.body : "";
    const painting = (req.body.painting) ? req.body.painting.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim() : "";

    //Metadata about post. Not needed in some games.
    const screenshot = (req.body.screenshot) ? req.body.screenshot : "";
    const app_data = (req.body.app_data) ? req.body.app_data.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim() : "";
    const topic_tag = (req.body.topic_tag) ? req.body.topic_tag : "";
    const search_key = (req.body.search_key) ? req.body.search_key : "";
    var title_owned = (req.body.owns_title == 1) ? 1 : 0;
    var platform;

    //If there is no owns_title field in the formdata, it must be from in-game, in that case, set owns_title to true
    if (!req.body.owns_title) { title_owned = 1; }

    //If no body or painting exists, what is there to post??
    if (!body && !painting) { res.sendStatus(400); logger.error("No body or painting was inputed."); return; }
    if (!feeling_id || !language_id || !community_id || !is_spoiler || !is_autopost || !is_app_jumpable) { res.sendStatus(400); logger.error("Faulty post create request."); return;}

    //Checking if the community id is 0, if it is, then get the community that shares the requests parampack title id.
    if (community_id == 0) {
        community_id = await db_con.env_db("communities").whereLike("title_ids", `%${req.param_pack.title_id}%`)

        //Checking if there is an avaliable community
        if (community_id.length == 0) { res.sendStatus(404); logger.error(`Couldn't find a community for the Title ID: ${Number(req.param_pack.title_id).toString(16)}`); return;}

        community_id = community_id[0].id;
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
    var community = (await db_con.env_db("communities").where({id : community_id}))[0]

    if (community.post_type == "text" && painting) { res.sendStatus(400); logger.error("Text only community!"); return;}
    if (community.post_type == "memo" && body) { res.sendStatus(400); logger.error("Memo only community!"); return;}
    if (community.type == "announcement" && req.account[0].admin == 0) { res.sendStatus(503); logger.error(`${req.account[0].nnid} tried to post to ${community.name}`); return; }

    //Create the post insert data
    const insert_data = 
    {
        feeling_id : feeling_id,
        language_id : language_id,
        country_id : req.param_pack.country_id,
        region_id : req.param_pack.region_id,
        title_id : req.param_pack.title_id, 
        platform_id : req.param_pack.platform_id,
        community_id : community_id,

        account_id : req.account[0].id,
        pid : req.account[0].pid,

        posted_from : platform,
        title_owned : title_owned,

        spoiler : is_spoiler, 
        is_app_jumpable : is_app_jumpable,
        is_autopost : is_autopost,

        moderated : 0
    }

    if (body) {insert_data.body = body}
    if (painting) {insert_data.painting = painting}
    if (screenshot) {insert_data.screenshot = screenshot}
    if (app_data) {insert_data.app_data = app_data}
    if (topic_tag) {insert_data.topic_tag = topic_tag}
    if (search_key) {insert_data.search_key = JSON.stringify(search_key)}

    const insert_id = (await db_con.env_db("posts").insert(insert_data))[0];

    //TODO: if painting or screenshot, save a copy of either as .jpg in cdn

    if (painting) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/paintings/${insert_id}.png`, decoder.paintingProccess(painting), 'base64');
        const painting_result = await cdn_upload.uploadImage(__dirname + `/../../../CDN_Files/img/paintings/${insert_id}.png`, "paintings");
        
        const update_data = {
            painting_cdn_url : painting_result.secure_url
        }

        await db_con.env_db("posts").update(update_data).where("id", insert_id)

        logger.info(`Saved painting.`)
    }

    if (screenshot) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/screenshots/${insert_id}.jpg`, screenshot, 'base64');
        const screenshot_result = await cdn_upload.uploadImage(__dirname + `/../../../CDN_Files/img/screenshots/${insert_id}.jpg`, "screenshots");

        const update_data = {
            screenshot_cdn_url : screenshot_result.secure_url
        }

        await db_con.env_db("posts").update(update_data).where("id", insert_id)
        logger.info(`Saved screenshot.`)
    }

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::New-post");
    res.sendStatus(200);
    logger.info(`${req.account[0].nnid} posted to ${community.name}!`)
})

route.post("/:post_id/empathies", async (req, res) => {
    const post_id = req.params.post_id;
    const post = (await db_con.env_db("posts").where({id : post_id}))[0]

    if (!post) { res.sendStatus(404); return; }
    if (post.account_id == req.account[0].id) { res.sendStatus(403); return;}

    const current_yeah = (await db_con.env_db("empathies").where({account_id : req.account[0].id, post_id : post_id}))[0]

    //Checking to see if the user has already yeah'd the post
    if (current_yeah) {
        //If the user has yeah'd, delete the empathy in the database for them
        await db_con.env_db("empathies").where({account_id : req.account[0].id, post_id : post_id}).del();
        logger.info(`${req.account[0].nnid} un-empathied post: ${post_id}!`);

        //Once that is finished, send a 200 (OK) response
        //Also for portal and n3ds, send a json containing the result.
        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Empathy-delete");
        res.status(200).send({result : "deleted"});

        //Delete the old notification
        await db_con.env_db("notifications").where({content_id : current_yeah.id, from_account_id : req.account[0].id}).del();
    } else {
        //If the user hasn't yeah'd, create an empathy in the database for them
        const new_empathy = await db_con.env_db("empathies").insert({post_id : post_id, account_id : req.account[0].id})

        //Once that is finished, send a 200 (OK) response
        //Also for portal and n3ds, send a json containing the result.
        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Empathy-create");
        res.status(200).send({result : "created"});
        logger.info(`${req.account[0].nnid} empathied post: ${post_id}!`);

        //Create a new notification
        //TODO: FIX await common.notification.createNewNotification(post.account_id, req.account[0].id, 'yeah', new_empathy[0], `/posts/${post.id}`, post.id)
    }
})

module.exports = route;
