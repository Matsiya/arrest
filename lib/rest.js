/*!
 * arrest-couchbase
 * Copyright(c) 2014 Alexis Reverte - Matsiya. <info@matsiya.com>
 * MIT Licensed
 *
 * Forked from arrest by vivocha
 */

var util = require('util')
    , EventEmitter = require('events').EventEmitter
    , CouchBaseClient = require('couchbase');

function RestAPI() {
    this.routes = [
        { method: 'get',    mount: '',     handler: this._query },
        { method: 'get',    mount: '/:id', handler: this._get },
        { method: 'put',    mount: '/:id', handler: this._save },
        { method: 'post',   mount: '/:id', handler: this._save },
        { method: 'delete', mount: '/:id', handler: this._remove }
    ];
}
util.inherits(RestAPI, EventEmitter);
RestAPI.prototype.getRoutes = function() {
    return this.routes;
}

RestAPI.prototype._query = function(req, res) {
    this.query( this.options.designDoc, this.options.collection + "List", exports.responseCallback(res));
}
RestAPI.prototype._get = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else {
        this.get(req.params.id, exports.responseCallback(res));
    }
}
RestAPI.prototype._save = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else if (!req.body) {
        exports.sendError(res, 400, 'body missing');
    } else {
        this.save({ _id: req.params.id }, req.body, exports.responseCallback(res));
    }
}
RestAPI.prototype._remove = function(req, res) {
    if (!req.params.id) {
        exports.sendError(res, 400, 'id missing');
    } else {
        this.remove({ _id: ObjectID(req.params.id) }, exports.responseCallback(res));
    }
}

function RestCouchBaseAPI( options ) {
    RestAPI.call(this);

    var self = this;

    var connectOptions = {};

    if( options.couchBaseHosts && options.couchBaseHosts.length > 0 ) {
        connectOptions.host = options.couchBaseHosts;
    }

    options.bucket = connectOptions.bucket = options.bucket || "default";

    if( options.couchBasePassword && options.couchBasePassword.length > 0 ) {
        connectOptions.password = options.couchBasePassword;
    }

    options.designDoc = options.designDoc || options.bucket;
    options.collection = options.collection || options.bucket;

    this.options = options;

    this.db = new CouchBaseClient.Connection( connectOptions, function(err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('connect', self.db);
    });
}
util.inherits(RestCouchBaseAPI, RestAPI);

RestCouchBaseAPI.prototype._return = function(err, data, isArray, cb) {
    if (!cb) {
        return;
    } else if (err) {
        cb(500, err.message ? err.message : err);
    } else if (!data) {
        cb(404);
    } else if (isArray) {
        cb(null, data);
    } else {
        cb(null, util.isArray(data) ? data[0] : data);
    }
}




RestCouchBaseAPI.prototype.query = function(ddoc, view, query, cb) {
    if (typeof query === 'function') {
        cb = query;
        query = {};
    }

    var self = this;

    self.db.view(ddoc, view).query(query, function(err, datas) {
        self._return(err, datas, true, cb );
    });
}
RestCouchBaseAPI.prototype.get = function(key, options, cb) {

    if( typeof options === 'function') {
        cb = options;
        options = {};
    }

    var self = this;
    self.db.get(key, options, function(err, data) {
        self._return(err, data, false, cb);
    });
}
RestCouchBaseAPI.prototype.create = function(data, cb) {
    var self = this;
    self.db.collection(self.collection).insert(data, function(err, data) {
        self._return(err, data, false, cb);
    });
}
RestCouchBaseAPI.prototype.update = function(criteria, data, cb) {
    delete data._id;
    var self = this;
    self.db.collection(self.collection).update(criteria, data, { w: 1 }, function(err, _data) {
        if (criteria._id) {
            data._id = criteria._id.toString();
        }
        self._return(err, _data ? data : null, false, cb);
    });
}
RestCouchBaseAPI.prototype.remove = function(criteria, cb) {
    var self = this;
    self.db.collection(self.collection).remove(criteria, function(err, data) {
        if (err) {
            cb(500, err.message ? err.message : err);
        } else if (!data) {
            cb(400);
        } else {
            cb(null, '');
        }
    });
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

