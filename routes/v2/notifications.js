const express = require('express');
const route = express.Router();

const db_con = require('../../../shared_config/database_con');

route.get("/", async (req, res) => {
    const notifications = await db_con.env_db("notifications").where({ account_id: req.account[0].id, read: 0 })
    //This would eventually be the messages query, but since we don't have them yet, we'll just put in 0.

    if (notifications.length >= 1) {
        const response_body =
        {
            result: "success", notifications: {
                notifications_length: notifications.length,
                messages_length: 0
            }
        }

        res.status(200).send(response_body)
    } else {
        const response_body =
        {
            result: "success"
        }

        res.status(204).send(response_body)
    }
})

module.exports = route