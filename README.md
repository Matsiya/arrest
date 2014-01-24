arrest-couchbase
================

REST framework for Node.js, Express and CouchBase

Arrest lets you write RESTful web services in minutes. It works with Express,
implements simple CRUD semantics on CouchBase and the resulting web services
are compatible with the $resource service of AngularJS.

## How to Install

```bash
npm install arrest-couchbase
```

## Super Simple Sample

The following sample application shows how to attach a simple REST API to and express
application. In the sample, the path */api* is linked to a *data* bucket
on a Couchbase instance running on *localhost*:

```js
var arrest = require('arrest-couchbase')
  , express = require('express')
  , app = express()

app.use(express.bodyParser());

arrest.use(app, '/api', new arrest.RestCouchBaseAPI(['localhost:8091'], 'data', '', 'data'));

app.listen(3000);
```

Now you can query your *data* collection like this:

```bash
curl "http://localhost:3000/api"
```