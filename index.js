const packet = require('dns-packet')
const dgram = require('dgram')
const thunky = require('thunky')
const events = require('events')
const { allInterfaces, defaultInterface } = require('./tools.js')
const noop = function () {}

module.exports = function (opts) {
  if (!opts) opts = {}

  const that = new events.EventEmitter()
  let port = typeof opts.port === 'number' ? opts.port : 5353
  const type = opts.type || 'udp4'
  const ip = opts.ip || opts.host || (type === 'udp4' ? '224.0.0.251' : null)
  const me = { address: ip, port }
  let memberships = {}
  let destroyed = false
  let interval = null

  if (type === 'udp6' && (!ip || !opts.interface)) {
    throw new Error('For IPv6 multicast you must specify `ip` and `interface`')
  }

  const socket = opts.socket || dgram.createSocket({
    type,
    reuseAddr: opts.reuseAddr !== false,
    toString: function () {
      return type
    }
  })

  socket.on('error', function (err) {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') that.emit('error', err)
    else that.emit('warning', err)
  })

  socket.on('message', function (message, rinfo) {
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

  socket.on('listening', function () {
    if (!port) port = me.port = socket.address().port
    if (opts.multicast !== false) {
      that.update()
      interval = setInterval(that.update, 5000)
      socket.setMulticastTTL(opts.ttl || 255)
      socket.setMulticastLoopback(opts.loopback !== false)
    }
  })

  const bind = thunky(function (cb) {
    if (!port || opts.bind === false) return cb(null)
    socket.once('error', cb)
    socket.bind(port, opts.bind || opts.interface, function () {
      socket.removeListener('error', cb)
      cb(null)
    })
  })

  bind(function (err) {
    if (err) return that.emit('error', err)
    that.emit('ready')
  })

  that.send = function (value, rinfo, cb) {
    if (typeof rinfo === 'function') return that.send(value, null, rinfo)
    if (!cb) cb = noop
    if (!rinfo) rinfo = me
    else if (!rinfo.host && !rinfo.address) rinfo.address = me.address

    bind(onbind)

    function onbind (err) {
      if (destroyed) return cb()
      if (err) return cb(err)
      const message = packet.encode(value)
      socket.send(message, 0, message.length, rinfo.port, rinfo.address || rinfo.host, cb)
    }
  }

  that.response =
  that.respond = function (res, rinfo, cb) {
    if (Array.isArray(res)) res = { answers: res }

    res.type = 'response'
    res.flags = (res.flags || 0) | packet.AUTHORITATIVE_ANSWER
    that.send(res, rinfo, cb)
  }

  that.query = function (q, type, rinfo, cb) {
    if (typeof type === 'function') return that.query(q, null, null, type)
    if (typeof type === 'object' && type && type.port) return that.query(q, null, type, rinfo)
    if (typeof rinfo === 'function') return that.query(q, type, null, rinfo)
    if (!cb) cb = noop

    if (typeof q === 'string') q = [{ name: q, type: type || 'ANY' }]
    if (Array.isArray(q)) q = { type: 'query', questions: q }

    q.type = 'query'
    that.send(q, rinfo, cb)
  }

  that.destroy = function (cb) {
    if (!cb) cb = noop
    if (destroyed) return process.nextTick(cb)
    destroyed = true
    clearInterval(interval)

    // Need to drop memberships by hand and ignore errors.
    // socket.close() does not cope with errors.
    for (const iface in memberships) {
      try {
        socket.dropMembership(ip, iface)
      } catch (e) {
        // eat it
      }
    }
    memberships = {}
    socket.close(cb)
  }

  that.update = function () {
    const ifaces = opts.interface ? [].concat(opts.interface) : allInterfaces()
    let updated = false

    for (let i = 0; i < ifaces.length; i++) {
      const addr = ifaces[i]
      if (memberships[addr]) continue

      try {
        console.log(ip, addr)
        socket.addMembership(ip, addr)
        memberships[addr] = true
        updated = true
      } catch (err) {
        that.emit('warning', err)
      }
    }

    if (updated) {
      if (socket.setMulticastInterface) {
        try {
          socket.setMulticastInterface(opts.interface || defaultInterface())
        } catch (err) {
          that.emit('warning', err)
        }
      }
      that.emit('networkInterface')
    }
  }

  return that
}
