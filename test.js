var mdns = require('./')
var tape = require('tape')
var dgram = require('dgram')

var port = function (cb) {
  var s = dgram.createSocket('udp4')
  s.bind(0, function () {
    var port = s.address().port
    s.on('close', function () {
      cb(port)
    })
    s.close()
  })
}

var test = function (name, fn) {
  tape(name, function (t) {
    port(function (p) {
      fn(mdns({ip: '127.0.0.1', port: p, multicast: false}), t)
    })
  })
}

test('works', function (dns, t) {
  t.plan(3)

  dns.once('query', function (packet) {
    t.same(packet.type, 'query')
    dns.destroy(function () {
      t.ok(true, 'destroys')
    })
  })

  dns.query('hello-world', function () {
    t.ok(true, 'flushed')
  })
})

test('A record', function (dns, t) {
  dns.once('query', function (packet) {
    t.same(packet.questions.length, 1, 'one question')
    t.same(packet.questions[0], {name: 'hello-world', type: 'A', class: 1})
    dns.response([{type: 'A', name: 'hello-world', ttl: 120, data: '127.0.0.1'}])
  })

  dns.once('response', function (packet) {
    t.same(packet.answers.length, 1, 'one answer')
    t.same(packet.answers[0], {type: 'A', name: 'hello-world', ttl: 120, data: '127.0.0.1', class: 1})
    dns.destroy(function () {
      t.end()
    })
  })

  dns.query('hello-world', 'A')
})

test('A record (two questions)', function (dns, t) {
  dns.once('query', function (packet) {
    t.same(packet.questions.length, 2, 'two questions')
    t.same(packet.questions[0], {name: 'hello-world', type: 'A', class: 1})
    t.same(packet.questions[1], {name: 'hej.verden', type: 'A', class: 1})
    dns.response([{type: 'A', name: 'hello-world', ttl: 120, data: '127.0.0.1'}, {type: 'A', name: 'hej.verden', ttl: 120, data: '127.0.0.2'}])
  })

  dns.once('response', function (packet) {
    t.same(packet.answers.length, 2, 'one answers')
    t.same(packet.answers[0], {type: 'A', name: 'hello-world', ttl: 120, data: '127.0.0.1', class: 1})
    t.same(packet.answers[1], {type: 'A', name: 'hej.verden', ttl: 120, data: '127.0.0.2', class: 1})
    dns.destroy(function () {
      t.end()
    })
  })

  dns.query([{name: 'hello-world', type: 'A'}, {name: 'hej.verden', type: 'A'}])
})

test('AAAA record', function (dns, t) {
  dns.once('query', function (packet) {
    t.same(packet.questions.length, 1, 'one question')
    t.same(packet.questions[0], {name: 'hello-world', type: 'AAAA', class: 1})
    dns.response([{type: 'AAAA', name: 'hello-world', ttl: 120, data: 'fe80::5ef9:38ff:fe8c:ceaa'}])
  })

  dns.once('response', function (packet) {
    t.same(packet.answers.length, 1, 'one answer')
    t.same(packet.answers[0], {type: 'AAAA', name: 'hello-world', ttl: 120, data: 'fe80::5ef9:38ff:fe8c:ceaa', class: 1})
    dns.destroy(function () {
      t.end()
    })
  })

  dns.query('hello-world', 'AAAA')
})

test('SRV record', function (dns, t) {
  dns.once('query', function (packet) {
    t.same(packet.questions.length, 1, 'one question')
    t.same(packet.questions[0], {name: 'hello-world', type: 'SRV', class: 1})
    dns.response([{type: 'SRV', name: 'hello-world', ttl: 120, data: {port: 11111, target: 'hello.world.com', priority: 10, weight: 12}}])
  })

  dns.once('response', function (packet) {
    t.same(packet.answers.length, 1, 'one answer')
    t.same(packet.answers[0], {type: 'SRV', name: 'hello-world', ttl: 120, data: {port: 11111, target: 'hello.world.com', priority: 10, weight: 12}, class: 1})
    dns.destroy(function () {
      t.end()
    })
  })

  dns.query('hello-world', 'SRV')
})

test('TXT record', function (dns, t) {
  dns.once('query', function (packet) {
    t.same(packet.questions.length, 1, 'one question')
    t.same(packet.questions[0], {name: 'hello-world', type: 'TXT', class: 1})
    dns.response([{type: 'TXT', name: 'hello-world', ttl: 120, data: 'hello=world,hej=verden'}])
  })

  dns.once('response', function (packet) {
    t.same(packet.answers.length, 1, 'one answer')
    t.same(packet.answers[0], {type: 'TXT', name: 'hello-world', ttl: 120, data: 'hello=world,hej=verden', class: 1})
    dns.destroy(function () {
      t.end()
    })
  })

  dns.query('hello-world', 'TXT')
})
