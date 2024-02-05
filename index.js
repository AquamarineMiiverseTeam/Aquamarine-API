const express = require('express');
const path = require('path');
const util = require('util')
const colors = require('colors');

const app = express();

const config_http = require('./config/http.json');
const logger = require('./middleware/log');
const db_con = require('../Aquamarine-Utils/database_con');

//Grab logger and auth middleware and use it. (Logs all incoming HTTP/HTTPS requests)
const auth = require('../Aquamarine-Utils/middleware/auth_middleware');
const access_control = require("./middleware/access_control")

app.use(logger.http_log);
app.use(auth);
app.use(access_control)

//Grab index of all routes and set them in our express app
const routes = require('./routes/index');
app.use("/v1/posts", routes.v1.API_POSTS);
//app.use("/v1/people", routes.v1.API_PEOPLE);
app.use("/v1/communities", routes.v1.API_COMMUNITIES);
app.use("/v1/topics", routes.v1.API_TOPICS);
//app.use("/v1/users", routes.v1.API_USERS);

//Set our app to listen on the config port
app.listen(config_http.port, async () => {
    console.log("[INFO] Listening on port %d".green, config_http.port);

    //Initializing database
    await db_con.raw("SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));")
    
    //TODO: add in account table and show number of accounts generated
    var num_posts = (await db_con("posts").count())[0]['count(*)']
    var num_communities = (await db_con("communities").count())[0]['count(*)']
    var num_accounts = (await db_con("accounts").count())[0]['count(*)']
    var num_empathies = (await db_con("empathies").count())[0]['count(*)']
    var num_favorites = (await db_con("favorites").count())[0]['count(*)']

    logger.log(`Number of Posts: ${num_posts}`)
    logger.log(`Number of Communities: ${num_communities}`)
    logger.log(`Number of Accounts: ${num_accounts}`)
    logger.log(`Number of Empathies: ${num_empathies}`)
    logger.log(`Number of Favorites: ${num_favorites}`)
})
