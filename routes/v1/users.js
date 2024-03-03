const express = require('express');
const route = express.Router();

const db_con = require('../../../Aquamarine-Utils/database_con');

const xmlbuilder = require('xmlbuilder');
const common = require('../../../Aquamarine-Utils/common');

route.get("/:user_pid/notifications", async (req, res) => {
    const notificationAccount = (await db_con("accounts").where({pid : req.params.user_pid}))

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
            // res.sendStatus(204);
            // // 204 no content is better for this case (and it succesfully made the icon not glow so yuh)
            res.sendStatus(404);
        }
    }
    else {
        res.sendStatus(404);
    }
})

module.exports = route