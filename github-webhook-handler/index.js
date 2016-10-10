const EventEmitter = require('events').EventEmitter,
  inherits = require('util').inherits,
  crypto = require('crypto'),
  bl = require('bl'),
  bufferEq = require('buffer-equal-constant-time');


function signBlob(key, blob) {
  return 'sha1=' + crypto.createHmac('sha1', key).update(blob).digest('hex')
}


function create(options) {
  if (typeof options != 'object')
    throw new TypeError('must provide an options object')

  if (typeof options.path != 'string')
    throw new TypeError('must provide a \'path\' option')

  if (typeof options.secret != 'string')
    throw new TypeError('must provide a \'secret\' option')

  var events

  if (typeof options.events == 'string' && options.events != '*')
    events = [options.events]

  else if (Array.isArray(options.events) && options.events.indexOf('*') == -1)
    events = options.events

  // make it an EventEmitter, sort of
  handler.__proto__ = EventEmitter.prototype
  EventEmitter.call(handler)

  return handler


  function handler(req, res, callback) {
    if (req.headers['x-github-event'] || req.headers['x-gitlab-event']) {
      handlerGithubOrGitlap(req, res, callback);
    }
    if (req.headers['x-gogs-event']) {
      handlerGogs(req, res, callback);
    }

  }

  function handlerGithubOrGitlap(req, res, callback) {
    console.log('on github handler');
    if (req.url.split('?').shift() !== options.path)
      return callback()

    function hasError(msg) {
      res.writeHead(400, {
        'content-type': 'application/json'
      })
      res.end(JSON.stringify({
        error: msg
      }))

      var err = new Error(msg)

      handler.emit('error', err, req)
      callback(err)
    }

    var sig = req.headers['x-hub-signature'];
    var token = req.headers['x-gitlab-token'];

    var event = req.headers['x-github-event'] || req.headers['x-gitlab-event'];
    var id = req.headers['x-github-delivery'];

    if (!sig)
     return hasError('No X-Hub-Signature or X-Gitlab-Token found on request')

    if (!event)
      return hasError('No X-Github-Event or X-Gitlab-Event found on request')

    //if (!id)
    // return hasError('No X-Github-Delivery or X-Gitlab-Delivery found on request')

    if (events && events.indexOf(event) == -1)
      return hasError('X-Github-Event is not acceptable')


    req.pipe(bl(function (err, data) {

      if (err) {
        return hasError(err.message)
      }
      var obj
      var computedSig = new Buffer(signBlob(options.secret, data))

      if (!bufferEq(new Buffer(sig), computedSig))
        return hasError('X-Hub-Signature does not match blob signature')
      else
      // check gitlap secret key
      if (token) {
        if (options.secret !== token)
          return hasError('X-Gitlab-Token does not match')
      } else
      // check gogs webhook secret key 
      {
        return hasError('missing options.secret')
      }


      try {
        obj = JSON.parse(data)
      } catch (e) {
        obj = req.body
          //return hasError(e)
      }

      res.writeHead(200, {
        'content-type': 'application/json'
      })
      res.end('{"ok":true}')

      if (req.headers['x-gitlab-event']) {
        event = obj['event_name'];
      }

      var emitData = {
        event: event,
        id: id,
        payload: obj,
        protocol: req.protocol,
        host: req.headers['host'],
        url: req.url
      }

      handler.emit(event, emitData)
      handler.emit('*', emitData)
    }))
  }

  function handlerGogs(req, res, callback) {
    if (req.url.split('?').shift() !== options.path)
      return callback()

    function hasError(msg) {
      res.writeHead(400, {
        'content-type': 'application/json'
      })
      res.end(JSON.stringify({
        error: msg
      }))

      var err = new Error(msg)

      handler.emit('error', err, req)
      callback(err)
    }


    var token = req.headers['x-gitlab-token'];
    var gogsSecret, body
    var event = req.headers['x-gogs-event'];

    if (req.method == 'POST') {
      var jsonString = '';

      req.on('data', function (data) {
        jsonString += data;
      });

      req.on('end', function () {
        body = JSON.parse(jsonString)
        gogsSecret = body.secret;
        if (!event)
          return hasError('x-gogs-event found on request')

        //if (!id)
        // return hasError('No X-Github-Delivery or X-Gitlab-Delivery found on request')

        if (events && events.indexOf(event) == -1)
          return hasError('x-gogs-event is not acceptable')


        if (options.secret !== gogsSecret) {

          return hasError('X-Gogs-Secret does not match')
        }
        res.writeHead(200, {
          'content-type': 'application/json'
        })
        res.end('{"ok":true}')

        obj = body;

        var emitData = {
          event: event,
          // id: id,
          payload: obj,
          protocol: req.protocol,
          host: req.headers['host'],
          url: req.url
        }

        handler.emit(event, emitData)
        handler.emit('*', emitData)

      });

      // console.log('post', post);

    }



  }
}



module.exports = create