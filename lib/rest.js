/*!
 * arrest-couchbase
 * Copyright(c) 2014 Alexis Reverte - Matsiya. <info@matsiya.com>
 * MIT Licensed
 *
 * Forked from arrest by vivocha
 */

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    request = require("request");

function RestAPI() {
    this.routes = [
        { method: 'get',    mount: '',          handler: this._query },
        { method: 'get',    mount: '/:id',      handler: this._get },
        { method: 'put',    mount: '/:id',      handler: this._save },
        { method: 'post',   mount: '/:id',      handler: this._save },
        { method: 'delete', mount: '/:id',      handler: this._remove }
    ];
}
util.inherits(RestAPI, EventEmitter);
RestAPI.prototype.getRoutes = function() {
    return this.routes;
}

RestAPI.prototype._query = function(req, res) {
    var query = req.query;

    //if( req.params.options ) query = JSON.parse( req.params.options );


    // Setting defaults
    var designDoc = this.options.designDoc,
        view = this.options.listView,
        auth = undefined,
        bucket = this.options.bucket;

    // Use user datas for design doc
    if( this.options.useTokenAttribute && this.options.useTokenAttribute.length > 0  ) {
        var decodedToken = req[this.options.useTokenAttribute];

        designDoc = decodedToken.designDoc;
        bucket = decodedToken.bucket;

        auth = {
            username: decodedToken.bucketUsername,
            password: decodedToken.bucketPassword,
            sendImmediately: false
        }
    }

    this.query( bucket, designDoc, view, auth, query, exports.responseCallback(res));
}
RestAPI.prototype._get = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else {

        var auth = undefined;

        if( this.options.useTokenAttribute && this.options.useTokenAttribute.length > 0  ) {
            var decodedToken = req[this.options.useTokenAttribute];

            auth = {
                username: decodedToken.bucketUsername,
                password: decodedToken.bucketPassword,
                sendImmediately: false
            };

            this.get(req.params.id, decodedToken.bucket, auth, exports.responseCallback(res));
        }
        else {
            this.get(req.params.id, this.options.bucket, auth, exports.responseCallback(res));
        }
    }
}
RestAPI.prototype._save = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else if (!req.body) {
        exports.sendError(res, 400, 'body missing');
    } else {
        var auth = undefined,
            bucket = this.options.bucket;

        if( this.options.useTokenAttribute && this.options.useTokenAttribute.length > 0  ) {
            var decodedToken = req[this.options.useTokenAttribute];

            auth = {
                username: decodedToken.syncGatewayUsername,
                password: decodedToken.syncGatewayPassword,
                sendImmediately: false
            };

            bucket = decodedToken.bucket;

            this.save(req.params.id, req.body, bucket, auth, exports.responseCallback(res));
        }
        else {
            this.save(req.params.id, req.body, bucket, auth, exports.responseCallback(res));
        }
    }
}
RestAPI.prototype._remove = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else {
        this.remove({ _id: req.params.id }, exports.responseCallback(res));
    }
}

function RestCouchBaseAPI( options ) {
    RestAPI.call(this);

    this.options = options;
}
util.inherits(RestCouchBaseAPI, RestAPI);

RestCouchBaseAPI.prototype._return = function(err, data, isArray, cb) {
    if (!cb) {
        return;
    } else if (err) {
        cb(err.code?err.code:500, err.message ? err.message : err);
    } else if (!data) {
        cb(404);
    } else if (isArray) {
        cb(null, data);
    } else {
        cb(null, util.isArray(data) ? data[0] : data);
    }
}




RestCouchBaseAPI.prototype.query = function(bucket, ddoc, view, auth, query, cb) {
    if (typeof auth === 'function') {
        cb = auth;
        query = {};
        auth = undefined;
    }
    else if( typeof query === 'function') {
        cb = query;
        query = undefined;
    }

    var self = this;

    var options = {
        uri: this.options.couchBaseRestHost + "/" + bucket + "/_design/" + ddoc + "/_view/" + view,
        method: 'GET',
        qs : query
    };

    if( auth != undefined ) {
        options.auth = auth
    }



    request(options, function (err, response, datas) {
        if( typeof datas == "string" )
            datas = JSON.parse(datas);

        self._return(err, datas, true, cb );
    });
}
RestCouchBaseAPI.prototype.get = function(key, bucket, auth, cb) {

    if (typeof auth === 'function') {
        cb = auth;
        auth = undefined;
    }

    var self = this;



    var options = {
        uri: this.options.couchBaseRestHost + "/" + bucket + "/" + key,
        method: 'GET'
    };

    if( auth != undefined ) {
        options.auth = auth
    }

    request(options, function (err, response, datas) {
        if( typeof datas == "string" )
            datas = JSON.parse(datas);

        if( datas.error ) {
            err = {
                code: 404,
                message: datas.reason
            };
        }

        self._return(err, datas, true, cb );
    });


}
RestCouchBaseAPI.prototype.save = function(id, datas, bucket, auth, cb) {
    if (typeof bucket === 'function') {
        cb = bucket;
        bucket = "default";
    }
    else if (typeof auth === 'function') {
        cb = auth;
        auth = undefined;
    }


    var self = this;

    var options = {
        uri: this.options.syncGatewayHost.host + bucket + '/' + id,
        method: 'PUT',
        json: datas
    };

    if( auth != undefined ) {
        options.auth = auth
    }

    if( datas._sync && datas._rev == undefined) {
        // Add _sync revision to the object if _sync exists (in case of using with syncGateway)
        datas._rev = datas._sync.rev;
    }

    request(options, function (err, response, datas) {
        self._return(err, datas, false, cb);
    });
}

RestCouchBaseAPI.prototype.remove = function(key, options, cb) {
    var self = this;

    if( typeof options === 'function') {
        cb = options;
        options = {};
    }

// TODO
//    self.db.remove( key, options, function(err, data) {
//        if (err) {
//            cb(500, err.message ? err.message : err);
//        } else {
//            cb(null, '');
//        }
//    });
}




exports.use = function(express, mount, api) {
    var routes = api.getRoutes();
    function getHandler(context, f) {
        return function(req, res) {
            f.call(context, req, res);
        }
    }

    for (var i = 0 ; i < routes.length ; i++) {
        express[routes[i].method](mount + routes[i].mount, getHandler(api, routes[i].handler));
    }
}
exports.throwError = function(code, message) {
    console.error(code, message);
    var err = new Error(message);
    err.code = code;
    throw err;
}
exports.sendError = function(res, code, message) {
    var data = { success: false };
    if (message) data.error = message;
    res.jsonp(code, data);
}
exports.responseCallback = function(res) {
    var self = this;
    return function(err, data) {
        if (err) {
            self.sendError(res, err.code || parseInt(err) || 400, err.message || data);
        } else {
            res.jsonp(data);
        }
    }
}
exports.RestAPI = RestAPI;
exports.RestCouchBaseAPI = RestCouchBaseAPI;

