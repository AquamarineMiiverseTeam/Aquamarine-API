const express = require('express');
const route = express.Router();

const util = require('util')
const xmlbuilder = require('xmlbuilder');
const multer = require('multer')

const con = require('../../database_con');
const query = util.promisify(con.query).bind(con);

const axios = require('axios');

const sha256 = require('sha256');

route.post("/", multer().none(), async (req, res) => {
    //Checking to make sure request doesn't already have an account attached
    if (req.account.length >= 1) {res.sendStatus(403); console.log("[ERROR] (%s) Account is already created.".red, moment().format("HH:mm:ss")); return;}
    
    //Grabbing neccesary login details
    var nnid = req.body.nnid;
    var service_token = req.service_token;
    var password = req.body.password;

})

module.exports = route;
