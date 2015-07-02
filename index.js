var packets = require('./packets')
var dgram = require('dgram')
var thunky = require('thunky')
var events = require('events')

var noop = function () {}

module.exports = function (opts) {
  if (!opts) opts = {}

  var that = new events.EventEmitter()
  var port = opts.port || 5353
  var type = opts.type || 'udp4'
  var ip = opts.ip || opts.host || (type === 'udp4' ? '224.0.0.251' : null)

  if (type === 'udp6' && (!ip || !opts.interface)) {
    throw new Error('For IPv6 multicast you must specify `ip` and `interface`')
  }

  var createSocket = function () {
    var socket = dgram.createSocket({
      type: type,
      reuseAddr: opts.reuseAddr !== false,
      toString: function () {
        return type
      }
    })

    socket.on('error', function (err) {
      that.emit('warning', err)
    })

    socket.on('message', function (message, rinfo) {
      try {
        message = packets.decode(message)
      } catch (err) {
        that.emit('warning', err)
        return
      }

      that.emit('packet', message, rinfo)

      if (message.type === 'query') that.emit('query', message, rinfo)
      if (message.type === 'response') that.emit('response', message, rinfo)
    })

    socket.on('listening', function () {
      if (opts.multicast !== false) {
        socket.addMembership(ip, opts.interface)
        socket.setMulticastTTL(opts.ttl || 255)
        socket.setMulticastLoopback(opts.loopback !== false)
      }
    })

    return socket
  }

  var receiveSocket = createSocket()
  var sendSocket = createSocket()

  var sendBind = thunky(function (cb) {
    sendSocket.on('error', cb)
    sendSocket.bind(0, function () {
      sendSocket.removeListener('error', cb)
      cb(null, sendSocket)
    })
  })

  receiveSocket.bind(port, function () {
    that.emit('ready')
  })

  that.send = function (packet, cb) {
    if (!cb) cb = noop
    sendBind(function (err, socket) {
      if (err) return cb(err)
      var message = packets.encode(packet)
      sendSocket.send(message, 0, message.length, port, ip, cb)
    })
  }

  that.response =
  that.respond = function (res, cb) {
    if (!cb) cb = noop
    if (Array.isArray(res)) res = {answers: res}

    res.type = 'response'
    that.send(res, cb)
  }

  that.query = function (q, type, cb) {
    if (typeof type === 'function') return that.query(q, null, type)
    if (!cb) cb = noop

    if (typeof q === 'string') q = [{name: q, type: type || 'A'}]
    if (Array.isArray(q)) q = {type: 'query', questions: q}

    q.type = 'query'
    that.send(q, cb)
  }

  that.destroy = function (cb) {
    if (!cb) cb = noop
    sendSocket.once('close', function () {
      receiveSocket.once('close', cb)
      receiveSocket.close()
    })
    sendSocket.close()
  }

  return that
}
