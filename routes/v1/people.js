const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../database_con');
const query = util.promisify(con.query).bind(con);

const axios = require('axios');

const crypto = require('crypto');

route.post("/", multer().none(), async (req, res) => {
    //Checking to make sure request doesn't already have an account attached
    if (req.account.length >= 1) {res.sendStatus(403); console.log("[ERROR] (%s) Account is already created.".red, moment().format("HH:mm:ss")); return;}
    if ((await query("SELECT id FROM accounts WHERE nnid=?", req.body.nnid)).length >= 1) {res.sendStatus(403); console.log(`[ERROR] (%s) Account is already created for ${req.body.nnid}.`.red, moment().format("HH:mm:ss")); return;}

    //Grabbing neccesary login details
    var nnid = req.body.nnid;
    var service_token = req.service_token;

    //Hashing and Salting the password
    var salt = crypto.randomBytes(8).toString('hex');
    var passwordHash = crypto.createHash('sha256').update(req.body.password + salt).digest('hex');

    var account_json;

    //Getting the full account data.
    try {
        account_json = (await axios.get("https://nnidlt.murilo.eu.org/api.php?env=production&user_id=" + nnid)).data;
        console.log(account_json);
    } catch (error) {
        console.log("[ERROR] (%s) %s".red, moment().format("HH:mm:ss"), error.response.data);
        res.status(error.response.status);
        res.send(error.response.data); return;
    }

    //Creating account in database
    await query(`INSERT INTO accounts (pid, nnid, mii, mii_name, mii_hash, bio, language_id, admin, banned, ${req.platform}_service_token, password_hash, password_salt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, 
    [account_json.pid, nnid, account_json.data, account_json.name, account_json.images.hash, "User has not set a bio yet..", req.param_pack.language_id, 0, 0, service_token, passwordHash, salt]);
    res.sendStatus(201);
})

route.post('/login', multer().none(), async (req, res) => {
    var nnid = req.body.nnid;

    var accounts = await query("SELECT * FROM accounts WHERE nnid=?", nnid);

    //Error checking
    if (accounts.length <= 0) { res.sendStatus(404); console.log("[ERROR] (%s) No account found for %s.".red, moment().format("HH:mm:ss"), nnid); return; }
    if (accounts.length > 1) { res.sendStatus(500); console.log("[ERROR] (%s) Something has gone horribly wrong. Pls fix db :)\nError on NNID %s".red, moment().format("HH:mm:ss"), nnid); return; }

    //Authenticating the password
    var account = accounts[0];
    var passwordHash = crypto.createHash('sha256').update(req.body.password + account.password_salt).digest('hex');

    //Adding the new token to the database!
    if (passwordHash == account.password_hash) {
        await query(`UPDATE accounts SET ${req.platform}_service_token=?`, req.service_token);
        res.sendStatus(201);
    } else {
        res.sendStatus(401);
    }
})

module.exports = route;
