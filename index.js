var packet = require('dns-packet')
var dgram = require('dgram')
var thunky = require('thunky')
var events = require('events')

var noop = function () {}

module.exports = function (opts) {
  if (!opts) opts = {}

  var that = new events.EventEmitter()
  var port = typeof opts.port === 'number' ? opts.port : 5353
  var type = opts.type || 'udp4'
  var ip = opts.ip || opts.host || (type === 'udp4' ? '224.0.0.251' : null)
  var me = {address: ip, port: port}
  var destroyed = false

  if (type === 'udp6' && (!ip || !opts.interface)) {
    throw new Error('For IPv6 multicast you must specify `ip` and `interface`')
  }

  // We need a sending *and* a receiving socket instance here.
  // Without this, the group isn't joined correctly and we won't get a response.
  // Downside of this atm is that every interface receives a response, but this
  // can be filtered upstream.
  var recvSocket = opts.socket || dgram.createSocket({
    type: type,
    reuseAddr: opts.reuseAddr !== false,
    toString: function () {
      return type
    }
  })
  var sendSocket =  opts.socket || dgram.createSocket({
    type: type,
    reuseAddr: opts.reuseAddr !== false,
    toString: function () {
      return type
    }
  })

  recvSocket.on('error', function (err) {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') that.emit('error', err)
    else that.emit('warning', err)
  })
  sendSocket.on('error', function (err) {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') that.emit('error', err)
    else that.emit('warning', err)
  })

  recvSocket.on('message', function (message, rinfo) {
    try {
      message = packet.decode(message)
    } catch (err) {
      that.emit('warning', err)
      return
    }

    that.emit('packet', message, rinfo)

    if (message.type === 'query') that.emit('query', message, rinfo)
    if (message.type === 'response') that.emit('response', message, rinfo)
  })

  recvSocket.on('listening', function () {
    if (!port) port = me.port = socket.address().port
    if (opts.multicast !== false) {
      recvSocket.addMembership(ip, opts.interface)
      recvSocket.setMulticastTTL(opts.ttl || 255)
      recvSocket.setMulticastLoopback(opts.loopback !== false)
    }
  })

  var sendBind = thunky(function (cb) {
    if (!port) return cb(null)
    sendSocket.once('error', cb)
    sendSocket.bind(port, opts.interface, function () {
      sendSocket.removeListener('error', cb)
      cb(null)
    })
  })
  var recvBind = thunky(function (cb) {
    if (!port) return cb(null)
    recvSocket.once('error', cb)
    recvSocket.bind(port, null, function () {
      recvSocket.removeListener('error', cb)
      cb(null)
    })
  })

  sendBind(function (err) {
    if (err) return that.emit('error', err)
    that.emit('ready')
  })
  recvBind(function (err) {
    if (err) return that.emit('error', err)
    that.emit('ready')
  })

  that.send = function (value, rinfo, cb) {
    if (typeof rinfo === 'function') return that.send(value, null, rinfo)
    if (!cb) cb = noop
    if (!rinfo) rinfo = me
    sendBind(function (err) {
      if (destroyed) return cb()
      if (err) return cb(err)
      var message = packet.encode(value)
      sendSocket.send(message, 0, message.length, rinfo.port, '224.0.0.251', cb)
    })
  }

  that.response =
  that.respond = function (res, rinfo, cb) {
    if (Array.isArray(res)) res = {answers: res}

    res.type = 'response'
    that.send(res, rinfo, cb)
  }

  that.query = function (q, type, rinfo, cb) {
    if (typeof type === 'function') return that.query(q, null, null, type)
    if (typeof type === 'object' && type && type.port) return that.query(q, null, type, rinfo)
    if (typeof rinfo === 'function') return that.query(q, type, null, rinfo)
    if (!cb) cb = noop

    if (typeof q === 'string') q = [{name: q, type: type || 'ANY'}]
    if (Array.isArray(q)) q = {type: 'query', questions: q}

    q.type = 'query'
    that.send(q, rinfo, cb)
  }

  that.destroy = function (cb) {
    if (!cb) cb = noop
    if (destroyed) return process.nextTick(cb)
    destroyed = true
    sendSocket.once('close', function () {
      recvSocket.once('close', cb)
      recvSocket.close()
    })
    sendSocket.close()
  }

  return that
}
