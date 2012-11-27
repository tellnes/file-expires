var request = require('request')
  , fs = require('fs')
  , path = require('path')
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , url = require('url')
  , extend = require('util')._extend
  , lt = require('long-timeout')
  , debugHttp = require('debug')('file-expires:http')
  , debugFs = require('debug')('file-expires:fs')



function createFileExpirer(file, options, cb) {
  var fe

  if (typeof options === 'function') {
    cb = options
    options = {}
  }

  if (isURL(file)) {
    fe = new HTTPFileExpirer(file, options, cb)
  } else {
    fe = new FSFileExpirer(file, options, cb)
  }

  return fe
}
exports = module.exports = createFileExpirer
exports.createFileExpirer = createFileExpirer



var URL = /^((http|udp|ftp)s?:\/\/)?([a-zA-Z1-90-]{2,}\.)+?([a-zA-Z1-90-]{2,6})(:\d{2,})?(\/\S+)*$/;
function isURL(str) {
  return URL.test(str)
}
exports.isURL = isURL



function FileExpirer() {
  EventEmitter.call(this)
}
inherits(FileExpirer, EventEmitter)
exports.FileExpirer = FileExpirer


function HTTPFileExpirer(uri, options, cb) {
  FileExpirer.call(this)
  this.uri = uri

  options = options || {}

  this.minTimeout = options.minTimeout || 60 * 1000


  this._needRequest = true

  var self = this
  process.nextTick(function() {
    if (!self._needRequest) return
    self.createReadStream({ method: 'HEAD' })
  })

  if (cb) this.readFile(cb)
}
inherits(HTTPFileExpirer, FileExpirer)
exports.HTTPFileExpirer = HTTPFileExpirer


HTTPFileExpirer.prototype.readFile = function(encoding, callback) {
  debugHttp('read file', this.uri)

  if (arguments.length == 1) {
    callback = encoding
    encoding = null
  }

  var chunks = []
    , length = 0

  var stream = this.createReadStream()

  stream.on('error', callback)

  stream.on('data', function(chunk) {
    chunks.push(chunk)
    length += chunk.length
  })

  stream.on('end', function() {
    var buffer = Buffer.concat(chunks, length)

    if (encoding) buffer = buffer.toString(encoding)

    callback(null, buffer)
  })

}

HTTPFileExpirer.prototype.createReadStream = function(options) {
  debugHttp('create read stream', this.uri)

  options = extend({}, options)
  options.uri = this.uri

  this._needRequest = false

  var req = request(options)
    , self = this

  req.on('response', function(res) {
    debugHttp('got response', self.uri)

    var expires = -Infinity
      , now = Date.now()

    if (res.headers['cache-control']) {
      var cacheControl = {}

      res.headers['cache-control'].replace(/\s/,'').split(',').forEach(function(dir) {
        var arr = dir.split('=')
        cacheControl[arr[0]] = arr[1]
      })

      if (cacheControl['max-age']) {

        expires = new Date(res.headers['date'])
        expires.setSeconds(expires.getUTCSeconds() + Number(cacheControl['max-age']))

      }

    } else if (res.headers['expires']) {
      expires = new Date(res.headers['expires'])
    }

    expires = expires - now
    if (expires <= self.minTimeout) expires = self.minTimeout

    debugHttp('expires %s', new Date(now + expires), self.uri)

    lt.clearTimeout(this.expiresTimeout)
    this.expiresTimeout = lt.setTimeout(function() {
      debugHttp('expires', self.uri)
      self.emit('expires')
    }, expires)



    var changed = false

    if (res.headers['etag']) {
      if (self.etag && self.etag != res.headers['etag']) changed = true
      self.etag = res.headers['etag']
    }

    if (res.headers['last-modified']) {
      var lastModified = new Date(res.headers['last-modified'])
      if (self.lastModified && self.lastModified != lastModified) changed = true
      self.lastModified = lastModified
    }


    if (changed) {
      debugHttp('changed', self.uri)
      self.emit('change')
    }

  })

  return req
}

HTTPFileExpirer.prototype.destroy = function() {
  debugHttp('destroy', self.uri)
  lt.clearTimeout(this.expiresTimeout)
}



function FSFileExpirer(uri, options, cb) {
  FileExpirer.call(this)

  options = options || {}

  if (options.cwd) uri = path.resolve(options.cwd, uri)
  this.uri = uri

  var self = this

  try {
    this.watcher = fs.watch(this.uri, function(type) {
      if (type !== 'change') return

      debugFs('got change notification', self.uri)

      self.emit('change')
      self.emit('expires')
    })
  } catch(err) {
    if (cb) return cb(err)

    process.nextTick(function() {
      self.emit('error', err)
    })
  }

  if (cb) this.readFile(cb)
}
inherits(FSFileExpirer, FileExpirer)
exports.FSFileExpirer = FSFileExpirer


FSFileExpirer.prototype.readFile = function(encoding, callback) {
  debugFs('read file', this.uri)

  if (arguments.length == 1) {
    return fs.readFile(this.uri, encoding)
  }

  return fs.readFile(this.uri, encoding, callback)
}

FSFileExpirer.prototype.createReadStream = function(options) {
  debugFs('create read stream', this.uri)

  return fs.createReadStream(this.uri, options)
}

FSFileExpirer.prototype.destroy = function() {
  debugHttp('destroy', self.uri)
  this.watcher.close()
}
