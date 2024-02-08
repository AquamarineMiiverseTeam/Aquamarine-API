const express = require('express');
const route = express.Router();
const multer = require('multer');
const moment = require('moment');
const axios = require('axios');
const crypto = require('crypto');

const logger = require('../../middleware/log');
const db_con = require('../../../Aquamarine-Utils/database_con');

route.post("/", multer().none(), async (req, res) => {
    //Checking to make sure request doesn't already have an account attached
    if ((await db_con("accounts").where({nnid : req.body.nnid}))[0]) { res.sendStatus(403); logger.error(`Account is already created with the Network ID of ${req.body.nnid}`); return; }

    //Grabbing neccesary login details
    const nnid = req.body.nnid;
    const service_token = req.service_token;
    const language = req.body.language;
    const country = req.body.country;
    const game_experience = req.body.game_experience;
    const password = req.body.password;

    if (!nnid || !service_token || !language || !country || !game_experience || !password) { res.sendStatus(400); logger.error(`Invalid request for making ${nnid}`); return; }

    //Hashing and Salting the password
    const salt = crypto.randomBytes(8).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(password + salt).digest('hex');

    var account_json;

    //Getting the full account data.
    try {
        logger.info(`Making request for ${nnid}..`)
        account_json = (await axios.get(`https://nnidlt.murilo.eu.org/api.php?env=production&user_id=${nnid}`)).data;
        logger.info(`Got request for ${nnid}`)
    } catch (error) {
        logger.error(`${error.response.data}`)
        res.status(error.response.data).send({success : 0, error : error.response.data}); 
        return;
    }

    //Creating account in database
    const new_account_id = (await db_con("accounts").insert({
        pid : account_json.pid,
        nnid : nnid,

        mii : account_json.data,
        mii_name : account_json.name,
        mii_hash : account_json.images.hash,

        password_hash : passwordHash,
        password_salt : salt,

        game_experience : game_experience,
        language : language,
        country : country
    }))[0]
    logger.info(`Created database account for ${nnid}`)

    if (req.platform === "3ds") {
        await db_con("accounts").update({
            "3ds_service_token" : req.service_token
        }).where({id : new_account_id})
    } else {
        await db_con("accounts").update({
            wiiu_service_token : req.service_token
        }).where({id : new_account_id})
    }

    logger.info(`Updated service token for ${nnid}`)
    
    res.status(200).send({success : 1})

    logger.info(`Successfully created new account for ${nnid}!`)
})

route.post('/login', multer().none(), async (req, res) => {
    const nnid = req.body.nnid;
    const service_token = req.service_token;
    const password = req.body.password;

    const account = (await db_con("accounts").where({nnid : nnid}))[0];

    //Error checking
    if (!account) { res.sendStatus(404); logger.error(`No account found for nnid: ${nnid}`); return; }

    const passwordHash = crypto.createHash('sha256').update(password + account.password_salt).digest('hex');

    //Adding the new token to the database!
    if (passwordHash == account.password_hash) {
        if (req.platform === "3ds") {
            await db_con("accounts").update({
                "3ds_service_token" : service_token
            }).where({id : account.id})
        } else {
            await db_con("accounts").update({
                wiiu_service_token : service_token
            }).where({id : account.id})
        }
        
        res.sendStatus(200);
        logger.info(`Successfully logged into ${nnid}`)
    } else {
        logger.error(`Password Mismatch!`)
        res.sendStatus(401);
    }
})

route.post("/update", async (req, res) => {
    var account_json;

    const nnid = req.account[0].nnid

    try {
        logger.info(`Making request for ${nnid}..`)
        account_json = (await axios.get(`https://nnidlt.murilo.eu.org/api.php?env=production&user_id=${nnid}`)).data;
        logger.info(`Got request for ${nnid}`)
    } catch (error) {
        logger.error(`${error.response.data}`)
        res.status(error.response.data).send({success : 0, error : error.response.data}); 
        return;
    }

    await db_con("accounts").update({
        mii : account_json.data,
        mii_name : account_json.name,
        mii_hash : account_json.images.hash,
        pid : account_json.pid
    }).where({id : req.account[0].id})
    
    logger.info(`Successfully updated ${nnid}!`)

    res.sendStatus(200);
})

module.exports = route;
