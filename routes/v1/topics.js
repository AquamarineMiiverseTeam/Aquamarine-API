const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../Aquamarine-Utils/database_con');
const query = util.promisify(con.query).bind(con);

const common = require('../../../Aquamarine-Utils/common')

route.get("/", async (req, res) => {
    //People is the max number of people the Wii U menu requests
    const people = req.query['people'];

    const communities = await query(`SELECT * FROM communities AS c WHERE platform="wiiu" AND NOT type="sub"
    ORDER BY 
    (SELECT COUNT(community_id) FROM posts WHERE community_id=c.id)
    DESC`)

    var xml = xmlbuilder.create("result")
        .e('has_error', '0').up()
        .e('version', '1').up()
        .e('request_name', 'topics').up()
        .e('expire', moment().add(10, 'hour').format('YYYY-MM-DD HH:MM:SS')).up()
        .e('topics');

    //Keeping a list of all the account_id's that have already been put in the topics XML
    var account_ids = []
    var account_ids_used = "";
    //Looping through every single community
    for (let i = 0; i < 10; i++) {
        const community = communities[i];

        //Making sure account_id/PID's are not repeating
        for (let i = 0; i < account_ids.length; i++) {
            account_ids_used += ` AND NOT account_id=${account_ids[i]} `;
        }

        const posts = await query(`SELECT * FROM posts WHERE community_id=${community.id} ${account_ids_used} GROUP BY account_id ORDER BY create_time DESC`);

        //Every community is code_named a topic
        xml = xml.e('topic')
            .e('empathy_count', (await query(`SELECT * FROM favorites WHERE community_id=${community.id}`)).length).up()
            .e('has_shop_page', '1').up()
            .e('icon', await common.wwp.encodeIcon(community.id)).up()
            .e('title_ids');
        JSON.parse(community.title_ids).forEach(element => {
            xml = xml.e('title_id', element).up()
        });
        xml = xml.up()
            .e('title_id', JSON.parse(community.title_ids)[0]).up()
            .e('community_id', community.id).up()
            .e('is_recommended', 0).up()
            .e('name', community.name).up()
            .e('people');
        for (const post of posts) {
            account_ids.push(post.account_id);
            const person = (await query("SELECT * FROM accounts WHERE id=?", post.account_id))[0]
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
                .e('empathy_count', (await query(`SELECT * FROM empathies WHERE post_id=${post.id}`)).length).up()
                .e('language_id', post.language_id).up()
                .e('mii', person.mii).up()
                .e('mii_face_url', "https://example.com").up()
                .e('number', '0').up();
            if (post.painting) {
                xml = xml.e('painting')
                    .e('format', 'tga').up()
                    .e('content', post.painting).up()
                    .e('size', post.painting.length).up()
                    .e('url', "https://s3.amazonaws.com/olv-public/pap/WVW69koebmETvBVqm1").up().up();
            }
            xml = xml.e('pid', post.pid).up()
                .e('platform_id', post.platform_id).up()
                .e('region_id', post.region_id).up()
                .e('reply_count', 0).up()
                .e('screen_name', person.mii_name).up()
            for (let i = 0; i < JSON.parse(community.title_ids).length; i++) {
                const title_id = JSON.parse(community.title_ids)[i];

                xml = xml.e('title_id', title_id).up()
            }

            xml = xml.up().up().up()
        }
        xml = xml.up().e('position', i + 1).up().up()
    }

    res.setHeader('X-Dispatch', "Olive::Web::API::V1::Topic-redirect_search");
    res.setHeader("content-type", "application/xml")
    res.send(xml.end({ pretty: true, allowEmpty: true }))
})

module.exports = route