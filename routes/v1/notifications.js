const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../Aquamarine-Utils/database_con');
const query = util.promisify(con.query).bind(con);

const common = require("../../../Aquamarine-Utils/common")

route.get("/", async (req, res) => {
    const notifications_messages = [];
    const notifications_normal = await common.notification.getAccountUnreadNotifications(req.account);

    if (req.get("content-type") == "text/json") {
        res.status(200).send({message_count : notifications_messages.length, notification_count : notifications_normal.length});
    } else {
        //Here's where XML specific code would go, we don't have it fully ready though.
    }
})

module.exports = route