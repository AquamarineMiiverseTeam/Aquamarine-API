const express = require('express');
const colors = require('colors');

const app = express();

const logger = require('./middleware/log');
const db_con = require('../shared_config/database_con');

//Grab logger and auth middleware and use it. (Logs all incoming HTTP/HTTPS requests)
const auth = require('../shared_config/middleware/auth_middleware');
const access_control = require("./middleware/access_control")
const api_logger = require("./middleware/api_logger")

app.use(logger.http_log);
app.use(auth);
app.use(api_logger)
app.use(access_control);

const routes = require('./routes/index');
logger.log("Creating v1 routes..");

for (const route of routes.v1) {
    app.use(route.path, route.route)
}

logger.log("Creating v2 routes..");

for (const route of routes.v2) {
    app.use(route.path, route.route)
}

//Set our app to listen on the config port
app.listen(config_http.port, async () => {
    console.log("[INFO] Current Environment: %s. Listening on port %d".green, JSON.parse(process.env.ENVIRONMENT)['ENV_NAME'], process.env.PORT);

    //Initializing database
    await db_con.env_db.raw("SET GLOBAL sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));")
    
    //TODO: add in account table and show number of accounts generated
    var num_posts = (await db_con.env_db("posts").count())[0]['count(*)']
    var num_communities = (await db_con.env_db("communities").count())[0]['count(*)']
    var num_accounts = (await db_con.account_db("accounts").count())[0]['count(*)']
    var num_empathies = (await db_con.env_db("empathies").count())[0]['count(*)']
    var num_favorites = (await db_con.env_db("favorites").count())[0]['count(*)']

    logger.log(`Number of Posts: ${num_posts}`)
    logger.log(`Number of Communities: ${num_communities}`)
    logger.log(`Number of Accounts: ${num_accounts}`)
    logger.log(`Number of Empathies: ${num_empathies}`)
    logger.log(`Number of Favorites: ${num_favorites}`)
})
