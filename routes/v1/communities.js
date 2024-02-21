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
    const main_community = (await db_con("communities").whereLike("title_ids", `%${parseInt(req.param_pack.title_id)}%`).where({ type: "main" }).limit(1))[0];

    console.log(main_community)

    //If theres no community, send a 404 (Not Found)
    if (!main_community) { res.sendStatus(404); logger.error(`Couldn't find main community for Title ID: ${Number(req.param_pack.title_id).toString(16)}`); return; }

    //Getting all sub communities for a game. Some game's have user made communities
    //which we need to get, other's use only official. The api must be aware of this,
    //and act accordingly.
    const sub_communites_query = db_con("communities")
    .select("communities.*")
    .where({ parent_community_id: main_community.id }).where(function () {
        if (req.query['type']) {
            switch (req.query['type']) {
                case "my":
                    this.where({ account_id: req.account[0].id })
                    break;
                case "official":
                    this.whereNot({ user_community: 1 })
                    break;
            }
        }
    }).orderBy("create_time", "desc").limit(limit)

    if (req.query['type'] == "favorite") {
        sub_communites_query.innerJoin("favorites", "favorites.community_id", "=", "communities.id")
        .where({"favorites.account_id" : req.account[0].id})
    }
    
    const sub_communites = await sub_communites_query;

    var xml = xmlbuilder.create("result")
        .e("has_error", 0).up()
        .e("version", 1).up()
        .e("request_name", "communities").up()
        .e("communities");

    for (let i = 0; i < sub_communites.length; i++) {
        const community = sub_communites[i];

        if (req.query['type'] == "favorite") {
            community.id = community.id
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

    xml = xml.up().end({ pretty: true, allowEmpty: true })

    res.setHeader('Content-Type', "application/xml")
    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-retrieve");
    res.send(xml);
})

//Creating New Communities
route.post("/", multer().none(), async (req, res) => {
    const main_community = (await db_con("communities").whereLike("title_ids", `%${parseInt(req.param_pack.title_id)}%`).where({ type: "main" }).limit(1))[0];

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
            name: name,
            description: description,
            app_data: app_data,

            platform: "wiiu",
            post_type: "all",
            type: "sub",

            user_community: 1,
            ingame_only: 0,
            special_community: 0,
            allow_custom_communities: 0,

            title_ids: main_community.title_ids,
            parent_community_id: main_community.id,

            account_id: req.account[0].id,
            pid: req.account[0].pid
        }
    )

    //Any community that is created must be favorited by the person who created it
    await db_con("favorites").insert(
        {
            community_id: main_community[0],
            account_id: req.account[0].id
        }
    )

    fs.writeFileSync(__dirname + `/../../../CDN_Files/img/icons/${new_community[0]}.jpg`, icon_jpeg, 'base64');

    //Finally sending a 200 (OK) as a result
    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-create");
    res.sendStatus(200);

    logger.info(`Created New User-generated Community! Parent Community: ${main_community.name}`)
})

route.get('/:community_id/posts', async (req, res) => {
    //Getting querys
    const limit = (req.query['limit']) ? Number(req.query['limit']) : 100;
    const language_id = (req.query['language_id']) ? Number(req.query['language_id']) : 254;

    const search_key = (req.query['search_key']) ? String(req.query['search_key']) : null;
    const pid = (req.query['pid']) ? Number(req.query['pid']) : null;
    const type = (req.query['type']) ? req.query['type'] : null;
    const by = (req.query['by']) ? req.query['by'] : null;

    const distinct_pid = (req.query['distinct_pid'] == 1) ? true : false;
    const allow_spoiler = (req.query['allow_spoiler'] == 1) ? true : false;

    //Community id's are usually set to 0 or 0xFFFFFFFF (4294967295) for in-game post grabbing, so, we have to get them by the title id from the parampack
    var community_id;
    var backupcommunity_id;
    if (req.params.community_id == 0) {
        community_id = (await db_con("communities").whereLike("title_ids", `%${parseInt(req.param_pack.title_id)}%`))[0].id
    } else { community_id = req.params.community_id }

    if (req.params.community_id == 4294967295) { community_id = 19887 }

    //If community doesn't exist, send a 404 (Not Found)
    if (!community_id) { res.sendStatus(404); console.log("[ERROR] (%s) Community ID(s) could not be found for %s.".red, moment().format("HH:mm:ss"), req.param_pack.title_id); return; }

    //Grabbing posts from DB with parameters
    const postsQuery = db_con("posts");

    // Check if the feature should be enabled
    if (req.query['distinct_pid']) {
        postsQuery.select('*')
            .from(function () {
                this.select('account_id', db_con.raw('MAX(create_time) as latest_create_time'))
                    .from('posts')
                    .where({ community_id: community_id })
                    .groupBy('account_id')
                    .as('latest_posts');
            })
            .innerJoin('posts', function () {
                this.on('latest_posts.account_id', '=', 'posts.account_id')
                    .andOn('latest_posts.latest_create_time', '=', 'posts.create_time');
            });
    }

    // Apply your existing conditions
    postsQuery.where(function () {
        if (!req.query['distinct_pid']) {
            this.where({community_id : community_id})
        }

        // Your existing conditions here
        if (search_key) {
            let search_key_array = search_key.split(",")
            if (search_key_array.length == 1) {
                this.where("search_key", "like", `%${JSON.stringify(search_key)}%`);
            } else {
                this.where("search_key", "like", `%${JSON.stringify(search_key_array)}%`);
            }
        }
        if (pid) { this.where({ pid: pid }); }
        if (type && type === "memo") { this.whereNotNull("painting"); }
        if (type && type === "text") { this.whereNotNull("body"); }
        if (by && by === "self") { this.where({ account_id: req.account[0].id }); }
        if (!allow_spoiler) { this.where({ spoiler: 0 }); }
        if (language_id !== 254) { this.where({ language_id: language_id }); }
    });

    const posts = await postsQuery;



    logger.info(`Found ${posts.length} posts.`)

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
    for (const post of posts) {
        const account_posted = (await db_con("accounts").where({ id: post.account_id }))[0]
        const empathy_count = (await db_con("empathies").count(`id`))[0]['count(`id`)'];
        const empathy_added = (await db_con("empathies").where({ account_id: req.account[0].id, post_id: post.id })).length

        xml = xml.e("post")
            .e("app_data", post.app_data).up()
            .e("body", post.body).up()
            .e("community_id", post.community_id).up()
            .e('mii', account_posted.mii).up()
            .e('mii_face_url', `http://mii-images.account.nintendo.net/${account_posted.mii_hash}_normal_face.png`).up()
            .e("country_id", post.country_id).up()
            .e("created_at", moment(post.create_time).format("YYYY-MM-DD HH:MM:SS")).up()
            .e("feeling_id", post.feeling_id).up()
            .e("id", post.id).up()
            .e("is_autopost", post.is_autopost).up()
            .e("is_community_private_autopost", "0").up()
            .e("is_spoiler", post.spoiler).up()
            .e("is_app_jumpable", post.is_app_jumpable).up()
            .e("empathy_count", empathy_count).up()
            .e('empathy_added', empathy_added).up()
            .e("language_id", post.language_id).up()
            .e("number", 1).up();
        if (post.painting) {
            xml = xml.e("painting")
                .e("format", "tga").up()
                .e("content", post.painting).up()
                .e("size", post.painting.length).up()
                .e("url", "https://s3.amazonaws.com/olv-public/pap/WVW69koebmETvBVqm1").up()
                .up();
        }
        if (post.topic_tag) {
            xml = xml.e('topic_tag')
                .e('name', post.topic_tag).up()
                .e('title_id', post.title_id).up().up()
        }
        xml = xml.e("pid", post.pid).up()
            .e("platform_id", post.platform_id).up()
            .e("region_id", post.region_id).up()
            //TODO: add proper reply count once replies are working
            .e("reply_count", 0).up()
            .e("screen_name", account_posted.mii_name).up()
            .e("title_id", post.title_id).up().up()
    }

    xml = xml.end({ pretty: true, allowEmpty: true });

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Post-search_by_topic");
    res.setHeader('Content-Type', "application/xml")
    res.send(xml)
})

route.post("/:community_id.:favorite_status", async (req, res) => {
    //Getting the correct community to favorite
    const community_id = req.params.community_id;
    const community = (await db_con("communities").where({ id: community_id }))[0];

    //If no community exists, send 404
    if (community) { logger.error(`Couldn't find a community for Community ID: ${community_id}.`); res.sendStatus(404); return; }

    //Checking which method to use
    if (req.params.favorite_status == "unfavorite") {
        await db_con("favorites").del().where({
            community_id: community_id,
            account_id: req.account[0].id
        });

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-unfavorite");
        res.sendStatus(200);
    } else if (req.params.favorite_status == "favorite") {
        //Making sure a favorite from this user doesn't already exist.
        const existing_favorite = (await db_con("favorites").where({ community_id: community_id, account_id: req.account[0].id }))[0]
        if (existing_favorite) { logger.error(`Favorite already exists for Community ID: ${community_id} and ${req.account[0].nnid}`); res.sendStatus(400); return; }

        await db_con("favorites").insert({
            community_id: community_id,
            account_id: req.account[0].id
        })

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-favorite");
        res.sendStatus(200);
    }
})

route.post("/:community_id/favorite", async (req, res) => {
    //Getting the correct community to favorite
    const community_id = req.params.community_id;
    const community = (await db_con("communities").where({ id: community_id }))[0];

    //If no community exists, send 404
    if (!community) { logger.error(`Couldn't find a community for Community ID: ${community_id}.`); res.sendStatus(404); return; }
    const existing_favorite = (await db_con("favorites").where({ community_id: community_id, account_id: req.account[0].id }))[0]

    //Checking which method to use
    if (existing_favorite) {
        await db_con("favorites").del().where({
            community_id: community_id,
            account_id: req.account[0].id
        });

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-unfavorite");
        res.send({ result: "deleted" });
    } else if (!existing_favorite) {
        //Making sure a favorite from this user doesn't already exist.

        await db_con("favorites").insert({
            community_id: community_id,
            account_id: req.account[0].id
        })

        res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-favorite");
        res.send({ result: "created" });
    }
})

route.post("/:community_id/settings", multer().none(), async (req, res) => {
    //1 - Show All
    //2 - Hide Spoilers
    //3 - Hide Screenshots
    //4 - Hide Both

    const new_array = JSON.parse(req.account[0].community_settings)
    new_array[req.params.community_id] = req.body.view_setting

    await db_con("accounts").update({
        community_settings: JSON.stringify(new_array),
    }).where({ id: req.account[0].id })

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-set_view");
    res.sendStatus(200)
})

module.exports = route