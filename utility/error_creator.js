const xmlbuilder = require("xmlbuilder")

function error_create(error_message, error_code, http_code) {
    //Creating error messages to be sent to a client. This can provide a good description to the client about what went wrong and how to fix it.
    return xmlbuilder.create("result")
    .ele("has_error", 1).up()
    .ele("version", 1).up()
    .ele("code", http_code).up()
    .ele("error_code", error_code).up()
    .ele("message", error_message).up().up()
    .end({pretty : true});
}

module.exports = {error_create}