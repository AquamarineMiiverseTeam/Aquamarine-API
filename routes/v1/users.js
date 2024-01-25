const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../Aquamarine-Utils/database_con');
const query = util.promisify(con.query).bind(con);

const common = require('../../../Aquamarine-Utils/common')

route.get("/:user_id/notifications", async (req, res) => {
    res.setHeader("content-type", "application/xml")
    
    var glow = (await common.notification.getAccountUnreadNotifications(req.account)).length > 0;

    if (glow) res.status(200).send("<result/>");
    else res.sendStatus(404);
})

module.exports = route