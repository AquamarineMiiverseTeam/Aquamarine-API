const express = require('express');
const route = express.Router();

const db_con = require('../../../shared_config/database_con');

const xmlbuilder = require('xmlbuilder');
const moment = require('moment');

const decoder = require("../../utility/decoder")

route.get("/", async (req, res) => {
    //People is the max number of people the Wii U menu requests
    const people = req.query['people'];

    const communities = await db_con.env_db.select("*").from("communities AS c").where({ platform: "wiiu", type: "main" }).orderBy(function () {
        this.count("community_id").from("posts").whereRaw("community_id = `c`.id").whereBetween("create_time", [moment().subtract(5, "days").format("YYYY-MM-DD HH:mm:ss"), moment().add(1, "day").format("YYYY-MM-DD HH:mm:ss")])
    }, "desc").limit(10)

    var xml = xmlbuilder.create("result")
        .e('has_error', '0').up()
        .e('version', '1').up()
        .e('request_name', 'topics').up()
        .e('expire', moment().add(10, 'hour').format('YYYY-MM-DD HH:MM:SS')).up()
        .e('topics');

    //Keeping the positions of the icons in check
    var pos = 0;

    //Keeping a list of all the account_id's that have already been put in the topics XML
    var account_ids = []
    //Looping through every single community
    for (const community of communities) {
        const favorites = (await db_con.env_db("favorites").count("id").where({ community_id: community.id }))[0]["count(`id`)"]
        const latestPostsSubquery = db_con.env_db('posts')
            .select('account_id')
            .max('posts.create_time as latest_post_date')
            .where('community_id', community.id)
            .whereNotIn('account_id', account_ids)
            .groupBy('account_id')
            .as('latest_posts');

        const distinctPostsQuery = db_con.env_db('posts as p')
            .select('p.*')
            .join(latestPostsSubquery, function () {
                this.on('p.account_id', '=', 'latest_posts.account_id')
                    .andOn('p.create_time', '=', 'latest_posts.latest_post_date');
            });

        // Execute the query
        const posts = await distinctPostsQuery;

        //Every community is code_named a topic
        xml = xml.e('topic')
            .e('empathy_count', favorites).up()
            .e('has_shop_page', '1').up()
            .e('icon', await decoder.encodeIcon(community.id)).up()
            .e('title_ids');
        JSON.parse(community.title_ids).forEach(element => {
            xml = xml.e('title_id', element).up()
        });
        xml = xml.up()
            .e('title_id', JSON.parse(community.title_ids)[0]).up()
            .e('community_id', community.id).up()
            .e('is_recommended', 0).up()
            .e('name', community.name.replace("Community", "")).up()
            .e('people');
        for (const post of posts) {
            account_ids.push(post.account_id);

            const person = (await db_con.account_db("accounts").select("*").where({ id: post.account_id }))[0]
            const empathy_count = (await db_con.env_db("empathies").count("id").where({ post_id: post.id }))[0]['count(`id`)']
            //Eventually when replies are implemented, this will be an actual count, for now, it's 0
            const reply_count = 0;

            xml = xml.e('person')
                .e('posts')
                .e("post")
                .e('body', post.body).up()
                .e('community_id', community.id).up()
                .e('country_id', post.country_id).up()
                .e('created_at', moment(post.create_time).format('YYYY-MM-DD HH:MM:SS')).up()
                .e('feeling_id', post.feeling_id).up()
                .e('id', post.id).up()
                .e('is_autopost', post.is_autopost).up()
                .e('is_community_private_autopost', '0').up()
                .e('is_spoiler', post.spoiler).up()
                .e('is_app_jumpable', post.is_app_jumpable).up()
                .e('empathy_count', empathy_count).up()
                .e('language_id', post.language_id).up()
                .e('mii', person.mii).up()
                .e('mii_face_url', "https://example.com").up()
                .e('number', '0').up();
            if (post.painting) {
                xml = xml.e('painting')
                    .e('format', 'tga').up()
                    .e('content', post.painting).up()
                    .e('size', post.painting.length).up()
                    .e('url', post.painting_cdn_url).up().up();
            }
            xml = xml.e('pid', post.pid).up()
                .e('platform_id', post.platform_id).up()
                .e('region_id', post.region_id).up()
                .e('reply_count', reply_count).up()
                .e('screen_name', person.mii_name).up()
            for (let i = 0; i < JSON.parse(community.title_ids).length; i++) {
                const title_id = JSON.parse(community.title_ids)[i];

                xml = xml.e('title_id', title_id).up()
            }

            xml = xml.up().up().up()
        }
        xml = xml.up().e('position', pos += 1).up().up()
    }

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-redirect_search");
    res.setHeader("content-type", "application/xml")
    res.send(xml.end({ pretty: true, allowEmpty: true }))
})

module.exports = route