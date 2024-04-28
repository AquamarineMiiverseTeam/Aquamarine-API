const express = require('express');
const route = express.Router();
const bodyParser = require("body-parser")

const logger = require('../../middleware/log');
const db_con = require('../../../shared_config/database_con');

const decoder = require('../../utility/decoder');
const fs = require("fs");

const cdn_upload = require("../../utility/cdn_upload")
const moment = require("moment")

route.post("/", bodyParser.json(), async (req, res) => {
    const community_id = req.body.community_id;
    const feeling_id = req.body.feeling_id;
    const spoiler = req.body.spoiler;
    const title_owned = req.body.title_owned;

    const topic_tag = req.body.topic_tag;
    const body = req.body.body;
    const painting = req.body.painting;
    const screenshot = req.body.screenshot;
    var platform;

    if (title_owned == undefined || spoiler == undefined || feeling_id == undefined || community_id == undefined) {
        logger.error(`No title_owned, spoiler, feeling_id, or community_id from ${req.account[0].nnid}`);
        res.status(400).send({success: false, error : "MISSING_VALUES"});
        return;
    }
    if (!body && !painting) {
        logger.error(`No painting for body from ${req.account[0].nnid}`);
        res.status(400).send({success : false, error : "NO_BODY_OR_PAINTING"});
        return;
    }

    const community = (await db_con.env_db("communities").where({id : community_id}))[0]

    if (community.post_type == "text" && painting) { res.status(400).send({success : false, error : "TEXT_ONLY"}); logger.error("Text only community!"); return;}
    if (community.post_type == "memo" && body) { res.status(400).send({success : false, error : "PAINTING_ONLY"}); logger.error("Memo only community!"); return;}
    if (community.type == "announcement" && req.account[0].admin == 0) { res.status(400).send({success : false, error : "ANNOUNCEMENT_COMMUNITY"}); logger.error(`${req.account[0].nnid} tried to post to ${community.name}`); return; }

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

    if (body) { insert_data.body = body } else { insert_data.painting = painting }
    if (screenshot) { insert_data.screenshot = screenshot }
    if (topic_tag) {insert_data.topic_tag = topic_tag }

    //Checking for last post's content, to avoid spam.
    const last_post_content = (await db_con.env_db("posts").where({account_id : req.account[0].id})
    .whereBetween("create_time", [moment().subtract(10, "minutes").format("YYYY-MM-DD HH:mm:ss"), moment().add(10, "minutes").format("YYYY-MM-DD HH:mm:ss")])
    .orderBy("create_time", "desc").limit(1))[0]

    //Yes I know this is a bad if statement. will come back to it when I can.
    if (last_post_content) {
        if (body && last_post_content.body) {
            if (last_post_content.body.replace(" ", "") == body.replace(" ", "")) {
                res.status(400).send({success : false, error : "SPAM_DETECTED"}); 
            }
        }
    }

    const post_id = (await db_con.env_db("posts").insert(insert_data))[0]

    if (painting) {
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/paintings/${post_id}.png`, decoder.paintingProccess(painting), 'base64');
        const painting_result = await cdn_upload.uploadImage(__dirname + `/../../../CDN_Files/img/paintings/${post_id}.png`, "paintings");
        
        const update_data = {
            painting_cdn_url : painting_result.secure_url
        }

        await db_con.env_db("posts").update(update_data).where("id", post_id)

        logger.info(`Saved painting.`)
    }

    if (screenshot) {
        console.log(screenshot)
        fs.writeFileSync(__dirname + `/../../../CDN_Files/img/screenshots/${post_id}.jpg`, screenshot, 'base64');
        const screenshot_result = await cdn_upload.uploadImage(__dirname + `/../../../CDN_Files/img/screenshots/${post_id}.jpg`, "screenshots");

        const update_data = {
            screenshot_cdn_url : screenshot_result.secure_url
        }

        await db_con.env_db("posts").update(update_data).where("id", post_id)
        logger.info(`Saved screenshot.`)
    }

    res.status(201).send({success : true, post_id : post_id})
})



module.exports = route