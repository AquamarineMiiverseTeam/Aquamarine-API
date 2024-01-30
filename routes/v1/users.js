const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer');
const moment = require('moment');

const con = require('../../../Aquamarine-Utils/database_con');
const query = util.promisify(con.query).bind(con);

const common = require('../../../Aquamarine-Utils/common')
const database_query = require('../../../Aquamarine-Utils/database_query')

route.get("/:user_pid/notifications", async (req, res) => {
    //res.setHeader("content-type", "application/xml")

    const sql = `SELECT * FROM accounts WHERE pid=?`
    var notificationAccount = (await query(sql, req.params.user_pid));

    if (notificationAccount[0]) {
        const notifications = await common.notification.getAccountUnreadNotifications(notificationAccount)

        if (notifications.length > 0) {
            const result = {
                result: {
                    has_error: 0,
                    version: 1,
                    request_name: "notifications",
                    notifications: {
                        unread_notifications_length: notifications.length,
                        unread_messages_length: 0
                    }
                }
            }

            const xml = xmlbuilder.create(result).end({ allowEmpty: true })

            res.setHeader('X-Dispatch', "Olive::Web::API::V1::News-my_news");
            res.setHeader("content-type", "application/xml");
            res.status(200).send(xml);
        }
        else {
            console.log("no notifications found")
            // res.sendStatus(204);
            // // 204 no content is better for this case (and it succesfully made the icon not glow so yuh)
            res.sendStatus(404);
        }
    }
    else {
        console.log("notification account is null")
        res.sendStatus(404);
    }
})

module.exports = route