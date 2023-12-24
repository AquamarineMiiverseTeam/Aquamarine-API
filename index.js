const express = require('express');
const path = require('path');
const util = require('util')
const con = require('./database_con');
const query = util.promisify(con.query).bind(con);
const colors = require('colors');

const app = express();

const config_http = require('./config/http.json');
const config_database = require('./config/database.json');

//Grab logger and auth middleware and use it. (Logs all incoming HTTP/HTTPS requests)
const logger = require('./middleware/log');
const auth = require('./middleware/auth');

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'https://n3ds.olv.nonamegiven.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'x-nintendo-servicetoken,x-nintendo-parampack,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

app.use(logger);
app.use(auth);

//Grab index of all routes and set them in our express app
const routes = require('./routes/index');
app.use("/v1/posts", routes.API_POSTS);
app.use("/v1/people", routes.API_PEOPLE);
app.use("/v1/communities", routes.API_COMMUNITIES);

//Set our app to listen on the config port
app.listen(config_http.port, async () => {
    console.log("[INFO] Listening on port %d".green, config_http.port);

    //TODO: add in account table and show number of accounts generated
    var num_posts = (await query("SELECT COUNT(id) FROM posts"))[0]["COUNT(id)"];
    var num_communities = (await query("SELECT COUNT(id) FROM communities"))[0]["COUNT(id)"];
    var num_accounts = (await query("SELECT COUNT(id) FROM accounts"))[0]["COUNT(id)"];
    console.log("[STATUS] Database Status \n \nNumber of posts: %d \nNumber of communities: %d\nNumber of Accounts: %d".blue, num_posts, num_communities, num_accounts);
})
