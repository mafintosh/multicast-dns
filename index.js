var packets = require('./packets')
var dgram = require('dgram')
var thunky = require('thunky')
var events = require('events')

var noop = function() {}

module.exports = function(opts) {
  if (!opts) opts = {}

  var that = new events.EventEmitter()
  var ip = opts.ip || '224.0.0.251'
  var port = opts.port || 5353

  var bind = thunky(function(cb) {
    var socket = dgram.createSocket('udp4')

    socket.on('error', cb)
    socket.on('message', function(message, rinfo) {
      try {
        message = packets.decode(message)
      } catch (err) {
        that.emit('warning', err)
        return
      }

      if (message.type === 'query') that.emit('query', message, rinfo)
      if (message.type === 'response') that.emit('response', message, rinfo)
    })

    socket.bind(port, function() {
      if (opts.multicast !== false) {
        socket.addMembership(ip)
        socket.setMulticastTTL(opts.ttl || 255)
        socket.setMulticastLoopback(opts.loopback !== false)
      }

      socket.removeListener('error', cb)
      socket.on('error', function(err) {
        that.emit('warning', err)
      })

      that.emit('ready')

      cb(null, socket)
    })
  })

  bind()

  that.response = 
  that.respond = function(res, cb) {
    if (!cb) cb = noop
  
    bind(function(err, socket) {
      if (err) return cb(err)      

      res.type = 'response'
      var message = packets.encode(res)
      
      socket.send(message, 0, message.length, port, ip, cb)
    })    
  }

  that.query = function(name, type, cb) {
    if (typeof type === 'function') return that.query(name, null, type)
    if (!cb) cb = noop

    bind(function(err, socket) {
      if (err) return cb(err)

      var message = packets.encode({
        type: 'query',
        questions: [{
          name: name,
          type: type || 'A'
        }]
      })

      socket.send(message, 0, message.length, port, ip, cb)
    })
  }

  return that
}
