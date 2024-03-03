const express = require('express');
const route = express.Router();
const bodyParser = require("body-parser")

const logger = require('../../middleware/log');
const db_con = require('../../../Aquamarine-Utils/database_con');
const multer = require('multer');

route.post("/", bodyParser.json(), async (req, res) => {
    switch (req.body.tutorial_id) {
        case "news":
            await db_con("accounts")
                .where({ id: req.account[0].id })
                .update({
                    tutorial_news: 1
                })
            break;
        case "messages":
            await db_con("accounts")
                .where({ id: req.account[0].id })
                .update({
                    tutorial_messages: 1
                })
            break;
        default:
            logger.error(`Wrong tutorial_id (${req.body.tutorial_id})`)
            break;
    }

    logger.info(`Updated ${req.body.tutorial_id} tutorial for ${req.account[0].nnid}`)
    res.sendStatus(200)
})

module.exports = route