function access_control(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', "https://*.nonamegiven.xyz");

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'x-nintendo-servicetoken,x-nintendo-parampack,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
}

module.exports = access_control