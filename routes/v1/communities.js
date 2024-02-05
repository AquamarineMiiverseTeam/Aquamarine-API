const express = require('express');
const route = express.Router();

const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const fs = require('fs');

const logger = require('../../middleware/log');
const db_con = require('../../../Aquamarine-Utils/database_con');
const common = require('../../../Aquamarine-Utils/common');

route.get("/", async (req, res) => {
    //Getting querys and converting them to SQL
    const limit = (req.query['limit']) ? req.query['limit'] : 100

    //Grabing all communities
    const main_community = (await db_con("communities").whereLike("title_ids", `%${parseInt(req.param_pack.title_id)}%`).where({type : "main"}).limit(1))[0];

    //If theres no community, send a 404 (Not Found)
    if (!main_community) { res.sendStatus(404); logger.error(`Couldn't find main community for Title ID: ${Number(req.param_pack.title_id).toString(16)}`); return; }

    //Getting all sub communities for a game. Some game's have user made communities
    //which we need to get, other's use only official. The api must be aware of this,
    //and act accordingly.
    const sub_communites = await db_con("communities").where({parent_community_id : main_community.id, type : "sub"}).where(function() {
        if (req.query['type']) {
            switch (req.query['type']) {
                case "my":
                    this.where({account_id : req.account[0].id})
                    break;
                case "official":
                    this.whereNot({user_community : 1})
                    break;
                case "favorite":
                    break;
                default:
                    break;
            }
        }
    }).orderBy("create_time", "desc").limit(limit)

    var xml = xmlbuilder.create("result")
        .e("has_error", 0).up()
        .e("version", 1).up()
        .e("request_name", "communities").up()
        .e("communities");

    for (let i = 0; i < sub_communites.length; i++) {
        const community = sub_communites[i];

        if (req.query['type'] == "favorite") {
            community.id = community.community_id;
        }

        xml.e("community")
            .e("community_id", community.id).up()
            .e("name", community.name).up()
            .e("description", community.description).up()
            .e("icon", await common.wwp.encodeIcon(community.id)).up()
            .e("icon_3ds", "").up()
            .e("app_data", community.app_data).up()
            .e("pid", community.pid).up()
            .e("is_user_community", community.user_community).up().up();
    }

    xml = xml.up().end({pretty : true, allowEmpty : true})

    res.setHeader('Content-Type', "application/xml")
    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-retrieve");
    res.send(xml);
})

//Creating New Communities
route.post("/", multer().none(), async (req, res) => {
    const main_community = (await db_con("communities").whereLike("title_ids", `%${parseInt(req.param_pack.title_id)}%`).where({type : "main"}).limit(1))[0];

    //Making sure the community is valid to create for
    if (!main_community) { res.sendStatus(404); logger.error(`Could not create community for Title ID: ${Number(req.param_pack.title_id).toString(16)} `); return; }
    if (main_community.allow_custom_communities != 1) { res.sendStatus(400); logger.error(`${req.account[0].nnid} Tried to create a user-generated sub community for ${main_community.name}`); return; }

    //Getting all meta-deta about the community
    const icon = req.body.icon;
    const name = req.body.name;
    const description = req.body.description;
    const app_data = req.body.app_data.replace(/\0/g, "").replace(/\r?\n|\r/g, "").trim();

    if (!name || !description || !app_data || !icon) { res.sendStatus(400); logger.error(`${req.account[0].nnid} Made a faulty request to v1/communities`); return; }

    //Getting the real icon for the community
    const icon_jpeg = (await common.wwp.decodeIcon(icon)).slice(22, Infinity);

    //Creating the new community and creating the icon for it.
    //TODO: check and see if 3ds had POST v1/communities
    const new_community = await db_con("communities").insert(
        {
            name : name,
            description : description,
            app_data : app_data,

            platform : "wiiu",
            post_type : "all",
            type : "sub",
                        
            user_community : 1,
            ingame_only : 0,
            special_community : 0,
            allow_custom_communities : 0,

            title_ids : main_community.title_ids,
            parent_community_id : main_community.id,

            account_id : req.account[0].id,
            pid : req.account[0].pid
        }
    )

    //Any community that is created must be favorited by the person who created it
    await db_con("favorites").insert(
        {
            community_id : main_community[0],
            account_id : req.account[0].id
        }
    )

    fs.writeFileSync(__dirname + `/../../../CDN_Files/img/icons/${new_community.insertId}.jpg`, icon_jpeg, 'base64');

    //Finally sending a 200 (OK) as a result
    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-create");
    res.sendStatus(200);
})

route.post("/:community_id.favorite", async (req, res) => {
    //Getting the correct community to favorite
    const community_id = req.params.community_id;
    const community = (await query("SELECT * FROM communities WHERE id=?", community_id));

    //If no community exists, send 404
    if (community.length == 0) {console.log("[ERROR] (%s) Community could not be found for ID: %s.".red, moment().format("HH:mm:ss"), community_id); res.sendStatus(404); return;}

    //Getting if a favorite exists for this community
    const favorite = (await query("SELECT * FROM favorites WHERE community_id=? AND account_id=?", [community_id, req.account[0].id]))

    await query("INSERT INTO favorites (community_id, account_id) VALUES(?, ?)", [community_id, req.account[0].id])

    //res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-favorite");
    res.sendStatus(200);
})

route.post("/:community_id.unfavorite", async (req, res) => {
    //Getting the correct community to favorite
    const community_id = req.params.community_id;
    const community = (await query("SELECT * FROM communities WHERE id=?", community_id));

    //If no community exists, send 404
    if (community.length == 0) {console.log("[ERROR] (%s) Community could not be found for ID: %s.".red, moment().format("HH:mm:ss"), community_id); res.sendStatus(404); return;}

    //Getting if a favorite exists for this community
    const favorite = (await query("SELECT * FROM favorites WHERE community_id=? AND account_id=?", [community_id, req.account[0].id]))

    await query("DELETE FROM favorites WHERE community_id=? AND account_id=?", [community_id, req.account[0].id])

    //res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-unfavorite");
    res.sendStatus(200);
})

route.get('/:community_id/posts', async (req, res) => {
    //Getting querys and converting them to SQL
    const limit = (req.query['limit']) ? ` LIMIT ${req.query['limit']}` : '';
    const search_key = (req.query['search_key']) ? ` AND search_key LIKE "%${req.query['search_key']}%"` : '';
    const topic_tag = (req.query['topic_tag']) ? ` AND topic_tag LIKE "%${req.query['topic_tag']}%"` : '';
    const distinct_pid = (req.query['distinct_pid']) ? ` GROUP BY pid` : '';
    const allow_spoiler = (req.query['allow_spoiler']) ? `` : ` AND spoiler=0`;
    const pid = (req.query['pid']) ? ` AND pid=${req.query['pid']}` : ``
    var language_id = "";
    var type = "";
    var by = "";
    
    //If language_id isn't set to all, then find the true language id
    if (Number(req.query['language_id']) != 254 && req.query['language_id']) { language_id = ` AND language_id=${req.query['language_id']}` }

    //If type is given, specifiy an exact type
    if (req.query['type']) {
        switch (req.query['type']) {
            case "memo":
                type = " AND painting IS NOT NULL"
                break;
            case "text":
                type = " AND body IS NOT NULL"
                break;
            default:
                break;
        }
    }

    //If by is given, specify who
    if (req.query['by']) {
        switch (req.query['by']) {
            case "self":
                by = ` AND account_id=${req.account[0].id} `
                break;
            default:
                break;
        }
    }

    //Community id's are usually set to 0 or 0xFFFF (4294967295) for in-game post grabbing, so, we have to get them by the title id from the parampack
    var community_id;
    var backupcommunity_id;
    if (req.params.community_id == 0 || req.params.community_id == 4294967295) {
        community_id = (await query('SELECT id FROM communities WHERE title_ids LIKE "%?%"', parseInt(req.param_pack.title_id)))

        if (community_id.length <= 0) {
            community_id = "";
            backupcommunity_id = "";
        } else if (community_id.length == 1) {
            community_id = community_id[0].id;
            backupcommunity_id = community_id;
        } else {
            backupcommunity_id = community_id[0].id;
            var tempcommunityid = "";
            for (var h in community_id) {
                tempcommunityid += `'${community_id[h].id}', `;
            }
            community_id = tempcommunityid.slice(0, -2);
        }
    } else { community_id = req.params.community_id }

    //If community doesn't exist, send a 404 (Not Found)
    if (!community_id) { res.sendStatus(404); console.log("[ERROR] (%s) Community ID(s) could not be found for %s.".red, moment().format("HH:mm:ss"), req.param_pack.title_id); return;}

    //Grabbing posts from DB with parameters
    var sql = `SELECT * FROM posts WHERE community_id in (${community_id})${search_key}${topic_tag}${allow_spoiler}${pid}${type}${by}${language_id}${distinct_pid} ORDER BY create_time DESC ${limit}`;
    const posts = await query(sql);
    console.log("[INFO] (%s) Found %d posts for %s.".green, moment().format("HH:mm:ss"), posts.length, (await query("SELECT name FROM communities WHERE id=?", community_id))[0].name)

    var post_community_id;
    if (posts.length >= 1) {
        post_community_id = posts[0].community_id;
    } else {
        post_community_id = backupcommunity_id
    }

    let xml = xmlbuilder.create('result')
        .e('has_error', "0").up()
        .e('version', "1").up()
        .e('request_name', 'posts').up()
        .e('topic').e('community_id', post_community_id).up().up()
        .e('posts');
    for (let i = 0; i < posts.length; i++) {
        const account_posted = (await query("SELECT * FROM accounts WHERE pid=?", posts[i].pid))[0]

        xml = xml.e("post")
            .e("app_data", posts[i].app_data).up()
            .e("body", posts[i].body).up()
            .e("community_id", posts[i].community_id).up()
            .e('mii', account_posted.mii).up()
            .e('mii_face_url', `http://mii-images.account.nintendo.net/${account_posted.mii_hash}_normal_face.png`).up()
            .e("country_id", posts[i].country_id).up()
            .e("created_at", moment(posts[i].create_time).format("YYYY-MM-DD HH:MM:SS")).up()
            .e("feeling_id", posts[i].feeling_id).up()
            .e("id", posts[i].id).up()
            .e("is_autopost", posts[i].is_autopost).up()
            .e("is_community_private_autopost", "0").up()
            .e("is_spoiler", posts[i].spoiler).up()
            .e("is_app_jumpable", posts[i].is_app_jumpable).up()
            .e("empathy_count", (await query("SELECT * FROM empathies WHERE post_id=?", posts[i].id)).length).up()
            .e('empathy_added', (await query(`SELECT * FROM empathies WHERE post_id=${posts[i].id} AND account_id=${req.account[0].id}`)).length).up()
            .e("language_id", posts[i].language_id).up()
            .e("number", 1).up();
        if (posts[i].painting) {
            xml = xml.e("painting")
                .e("format", "tga").up()
                .e("content", posts[i].painting).up()
                .e("size", posts[i].painting.length).up()
                .e("url", "https://s3.amazonaws.com/olv-public/pap/WVW69koebmETvBVqm1").up()
                .up();
        }
        if (posts[i].topic_tag) {
            xml = xml.e('topic_tag')
                .e('name', posts[i].topic_tag).up()
                .e('title_id', posts[i].title_id).up().up()
        }
        xml = xml.e("pid", posts[i].pid).up()
            .e("platform_id", posts[i].platform_id).up()
            .e("region_id", posts[i].region_id).up()
            //TODO: add proper reply count once replies are working
            .e("reply_count", 0).up()
            .e("screen_name", account_posted.mii_name).up()
            .e("title_id", posts[i].title_id).up().up()
    }

    xml = xml.end({pretty : true, allowEmpty : true});

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Post-search_by_topic");
    res.setHeader('Content-Type', "application/xml")
    res.send(xml)
})

route.post("/:community_id/favorite", async (req, res) => {
    //Getting the correct community to favorite
    const community_id = req.params.community_id;
    const community = (await query("SELECT * FROM communities WHERE id=?", community_id));

    //If no community exists, send 404
    if (community.length == 0) {console.log("[ERROR] (%s) Community could not be found for ID: %s.".red, moment().format("HH:mm:ss"), community_id); res.sendStatus(404); return;}

    //Getting if a favorite exists for this community
    const favorite = (await query("SELECT * FROM favorites WHERE community_id=? AND account_id=?", [community_id, req.account[0].id]))

    if (favorite.length == 0) {
        await query("INSERT INTO favorites (community_id, account_id) VALUES(?, ?)", [community_id, req.account[0].id])

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-favorite");
        res.status(200).send({result : "created"});
    } else {
        await query("DELETE FROM favorites WHERE community_id=? AND account_id=?", [community_id, req.account[0].id])

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-unfavorite");
        res.status(200).send({result : "deleted"});
    }
})

route.post("/:community_id/settings", multer().none(), async (req, res) => {
    //1 - Show All
    //2 - Hide Spoilers
    //3 - Hide Screenshots
    //4 - Hide Both

    const new_array = JSON.parse(req.account[0].community_settings)
    new_array[req.params.community_id] = req.body.view_setting

    await query("UPDATE accounts SET community_settings=? WHERE id=?", [JSON.stringify(new_array), req.account[0].id])

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-set_view");
    res.sendStatus(200)
})

module.exports = route