const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../database_con');
const query = util.promisify(con.query).bind(con);

route.get('/:community_id/posts', async (req, res) => {
    
    //Getting querys and converting them to SQL
    const limit = (req.query['limit']) ? ` LIMIT ${req.query['limit']}` : '';
    const search_key = (req.query['search_key']) ? ` AND search_key LIKE "%${req.query['search_key']}%" ` : '';
    const topic_tag = (req.query['topic_tag']) ? ` AND topic_tag LIKE "%${req.query['topic_tag']}%" ` : '';
    const distinct_pid = (req.query['distinct_pid']) ? ` GROUP BY pid ` : '';
    var language_id = '';
    
    //If language_id isn't set to all, then find the true language id
    if (Number(req.query['language_id']) != 254) { language_id = ` AND language_id=${req.query['language_id']} ` }

    //Community id's are usually set to 0 for in-game post grabbing, so, we have to get them by the title id from the parampack
    var community_id;
    if (req.params.community_id == 0) {
        community_id = (await query('SELECT id FROM communities WHERE title_ids LIKE "%?%"'), req.param_pack.title_id)[0];
    } else { community_id = req.params.community_id }

    //If community doesn't exist, send a 404 (Not Found)
    if (!community_id) { res.sendStatus(404); console.log("[ERROR] (%s) Community id could not be found for %s.".red, moment().format("HH:mm:ss"), req.param_pack.title_id); return;}

    //Grabbing posts from DB with parameters
    var sql = `SELECT * FROM posts WHERE community_id=${community_id} ${search_key} ${topic_tag} ${language_id} ${distinct_pid} ORDER BY create_time DESC ${limit}`;
    const posts = await query(sql);

    let xml = xmlbuilder.create('result')
        .e('has_error', "0").up()
        .e('version', "1").up()
        .e('request_name', 'posts').up()
        .e('topic').e('community_id', community_id).up().up()
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
    res.setHeader('Content-Type', "application/xml")
    res.send(xml)
})

module.exports = route