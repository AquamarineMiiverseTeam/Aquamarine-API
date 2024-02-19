function access_control(req, res, next) {
    if (!req.get("origin")) { next(); return;}
    res.setHeader('Access-Control-Allow-Origin', req.get("origin"));

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'x-nintendo-servicetoken,x-nintendo-parampack,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
}

module.exports = access_control