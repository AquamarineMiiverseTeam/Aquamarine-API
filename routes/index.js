module.exports = {
    v1 : [
        {
            path : "/v1/communities",
            route : require("./v1/communities")
        },
        {
            path : "/v1/topics",
            route : require("./v1/topics")
        },
        {
            path : "/v1/posts",
            route : require("./v1/posts")
        },
        {
            path : "/v1/people",
            route : require("./v1/people")
        },
        {
            path : "/v1/users",
            route : require("./v1/users")
        }
    ],
    v2 : [
        
    ]
}