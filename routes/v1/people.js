const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer')

const con = require('../../database_con');
const query = util.promisify(con.query).bind(con);

route.post("/", multer().none(), async (req, res) => {
    //Checking to make sure request doesn't already have an account attached
    if (req.account) {res.sendStatus(403); return;}
    
    var nnid = req.body.nnid;

})

module.exports = route;
