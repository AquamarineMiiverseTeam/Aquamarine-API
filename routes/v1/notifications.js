const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../Aquamarine-Utils/database_con');
const query = util.promisify(con.query).bind(con);

route.get("/", async (req, res) => {
    const notifications = await query("SELECT * FROM notifications WHERE account_id=? ORDER BY create_time DESC", req.account[0].id)

    if (req.get("content-type") == "text/json") {
        res.status(200).send(notifications);
    } else {
        //Here's where XML specific code would go, we don't have it fully ready though.
    }
})