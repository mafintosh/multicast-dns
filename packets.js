var types = require('./types')
var ip = require('ip')

var name = {}
var FLUSH_MASK = 1 << 15
var QU_MASK = 1 << 15

name.decode = function (buf, offset) {
  var list = []
  var oldOffset = offset
  var len = buf[offset++]

  if (len >= 0xc0) {
    var res = name.decode(buf, buf.readUInt16BE(offset - 1) - 0xc000)
    name.decode.bytes = 2
    return res
  }

  while (len) {
    if (len >= 0xc0) {
      list.push(name.decode(buf, buf.readUInt16BE(offset - 1) - 0xc000))
      offset++
      break
    }

    list.push(buf.toString('utf-8', offset, offset + len))
    offset += len
    len = buf[offset++]
  }

  name.decode.bytes = offset - oldOffset
  return list.join('.')
}

name.encode = function (n, buf, offset) {
  var list = n.split('.')
  var oldOffset = offset

  for (var i = 0; i < list.length; i++) {
    var len = buf.write(list[i], offset + 1)
    buf[offset] = len
    offset += len + 1
  }

  buf[offset++] = 0

  name.encode.bytes = offset - oldOffset
  return buf
}

name.encodingLength = function (n) {
  return Buffer.byteLength(n) + 2
}

var str = {}

str.encode = function (s, buf, offset) {
  var len = buf.write(s, offset + 1)
  buf[offset] = len
  str.encode.bytes = len + 1
  return buf
}

str.decode = function (buf, offset) {
  var len = buf[offset]
  var s = buf.toString('utf-8', offset + 1, offset + 1 + len)
  str.decode.bytes = len + 1
  return s
}

str.encodingLength = function (s) {
  return Buffer.byteLength(s) + 1
}

var QUERY_FLAG = 0
var RESPONSE_FLAG = 1 << 15

var header = {}

header.decode = function (buf, offset) {
  header.decode.bytes = 12
  return {
    id: buf.readUInt16BE(offset),
    type: buf.readUInt16BE(offset + 2) & RESPONSE_FLAG ? 'response' : 'query',
    qdcount: buf.readUInt16BE(offset + 4),
    ancount: buf.readUInt16BE(offset + 6),
    nscount: buf.readUInt16BE(offset + 8),
    arcount: buf.readUInt16BE(offset + 10)
  }
}

header.encode = function (h, buf, offset) {
  buf.writeUInt16BE(h.id || 0, offset)
  buf.writeUInt16BE(h.type === 'response' ? RESPONSE_FLAG : QUERY_FLAG, offset + 2)
  buf.writeUInt16BE(h.qdcount, offset + 4)
  buf.writeUInt16BE(h.ancount, offset + 6)
  buf.writeUInt16BE(h.nscount, offset + 8)
  buf.writeUInt16BE(h.arcount, offset + 10)

  header.encode.bytes = 12
  return buf
}

header.encodingLength = function (h) {
  return 12
}

var runknown = {}

runknown.encode = function (data, buf, offset) {
  buf.writeUInt16BE(data.length, offset)
  data.copy(buf, offset + 2)

  runknown.encode.bytes = data.length + 2
  return buf
}

runknown.decode = function (buf, offset) {
  var len = buf.readUInt16BE(offset)
  var data = buf.slice(offset + 2, offset + 2 + len)
  runknown.decode.bytes = len + 2
  return data
}

runknown.encodingLength = function (data) {
  return data.length + 2
}

var rtxt = {}
var rnull = {}

rnull.encode =
rtxt.encode = function (data, buf, offset) {
  if (typeof data === 'string') data = new Buffer(data)
  var oldOffset = offset
  offset += 2

  if (!data || data.length === 0) {
    str.encode('', buf, offset)
    offset += str.encode.bytes
  } else {
    var len = data.length
    data.copy(buf, offset, 0, len)
    offset += len
  }

  buf.writeUInt16BE(offset - oldOffset - 2, oldOffset)
  rtxt.encode.bytes = offset - oldOffset
  return buf
}

rnull.decode =
rtxt.decode = function (buf, offset) {
  var oldOffset = offset
  var len = buf.readUInt16BE(offset)

  offset += 2

  var data = buf.slice(offset, offset + len)
  offset += len

  rtxt.decode.bytes = offset - oldOffset
  return data
}

rnull.encodingLength =
rtxt.encodingLength = function (data) {
  if (!data) return 3 // 2 bytes (RDATA field length) + 1 byte (single empty byte)
  if (!data || data.length === 0) return 3 // 2 bytes (RDATA field length) + 1 byte (single empty byte)
  return data.length + 2 // +2 bytes (RDATA field length)
}

var rhinfo = {}

rhinfo.encode = function (data, buf, offset) {
  var oldOffset = offset
  offset += 2
  str.encode(data.cpu, buf, offset)
  offset += str.encode.bytes
  str.encode(data.os, buf, offset)
  offset += str.encode.bytes
  buf.writeUInt32BE(offset - oldOffset - 2, oldOffset)
  rhinfo.encode.bytes = offset - oldOffset
  return buf
}

rhinfo.decode = function (buf, offset) {
  var oldOffset = offset

  var data = {}
  offset += 2
  data.cpu = str.decode(buf, offset)
  offset += str.decode.bytes
  data.os = str.decode(buf, offset)
  offset += str.decode.bytes
  rhinfo.decode.bytes = offset - oldOffset
  return data
}

rhinfo.encodingLength = function (data) {
  return str.encodingLength(data.cpu) + str.encodingLength(data.os) + 2
}

var rptr = {}

rptr.encode = function (data, buf, offset) {
  name.encode(data, buf, offset + 2)
  buf.writeUInt16BE(name.encode.bytes, offset)
  rptr.encode.bytes = name.encode.bytes + 2
  return buf
}

rptr.decode = function (buf, offset) {
  var data = name.decode(buf, offset + 2)
  rptr.decode.bytes = name.decode.bytes + 2
  return data
}

rptr.encodingLength = function (data) {
  return name.encodingLength(data) + 2
}

var rsrv = {}

rsrv.encode = function (data, buf, offset) {
  buf.writeUInt16BE(data.priority || 0, offset + 2)
  buf.writeUInt16BE(data.weight || 0, offset + 4)
  buf.writeUInt16BE(data.port || 0, offset + 6)
  name.encode(data.target, buf, offset + 8)

  var len = name.encode.bytes + 6
  buf.writeUInt16BE(len, offset)

  rsrv.encode.bytes = len + 2
  return buf
}

rsrv.decode = function (buf, offset) {
  var len = buf.readUInt16BE(offset)

  var data = {}
  data.priority = buf.readUInt16BE(offset + 2)
  data.weight = buf.readUInt16BE(offset + 4)
  data.port = buf.readUInt16BE(offset + 6)
  data.target = name.decode(buf, offset + 8)

  rsrv.decode.bytes = len + 2
  return data
}

rsrv.encodingLength = function (data) {
  return 8 + name.encodingLength(data.target)
}

var ra = {}

ra.encode = function (host, buf, offset) {
  buf.writeUInt16BE(4, offset)
  offset += 2
  ip.toBuffer(host, buf, offset)
  ra.encode.bytes = 6
  return buf
}

ra.decode = function (buf, offset) {
  offset += 2
  var host = ip.toString(buf, offset, 4)
  ra.decode.bytes = 6
  return host
}

ra.encodingLength = function (host) {
  return 6
}

var raaaa = {}

raaaa.encode = function (host, buf, offset) {
  buf.writeUInt16BE(16, offset)
  offset += 2
  ip.toBuffer(host, buf, offset)
  raaaa.encode.bytes = 18
  return buf
}

raaaa.decode = function (buf, offset) {
  offset += 2
  var host = ip.toString(buf, offset, 16)
  raaaa.decode.bytes = 18
  return host
}

raaaa.encodingLength = function (host) {
  return 18
}

var answer = {}

var renc = function (type) {
  switch (type.toUpperCase()) {
    case 'A': return ra
    case 'PTR': return rptr
    case 'TXT': return rtxt
    case 'NULL': return rnull
    case 'AAAA': return raaaa
    case 'SRV': return rsrv
    case 'HINFO': return rhinfo
  }
  return runknown
}

answer.decode = function (buf, offset) {
  var a = {}
  var oldOffset = offset

  a.name = name.decode(buf, offset)
  offset += name.decode.bytes
  a.type = types.toString(buf.readUInt16BE(offset))
  a.class = buf.readUInt16BE(offset + 2)
  a.ttl = buf.readUInt32BE(offset + 4)

  a.flush = !!(a.class & FLUSH_MASK)
  if (a.flush) a.class &= ~FLUSH_MASK

  var enc = renc(a.type)
  a.data = enc.decode(buf, offset + 8)
  offset += 8 + enc.decode.bytes

  answer.decode.bytes = offset - oldOffset
  return a
}

answer.encode = function (a, buf, offset) {
  var oldOffset = offset

  name.encode(a.name, buf, offset)
  offset += name.encode.bytes

  buf.writeUInt16BE(types.toType(a.type), offset)

  var klass = a.class === undefined ? 1 : a.class
  if (a.flush) klass |= FLUSH_MASK // the 1st bit of the class is the flush bit
  buf.writeUInt16BE(klass, offset + 2)

  buf.writeUInt32BE(a.ttl || 0, offset + 4)

  var enc = renc(a.type)
  enc.encode(a.data, buf, offset + 8)
  offset += 8 + enc.encode.bytes

  answer.encode.bytes = offset - oldOffset
  return buf
}

answer.encodingLength = function (a) {
  return name.encodingLength(a.name) + 8 + renc(a.type).encodingLength(a.data)
}

var question = {}

question.decode = function (buf, offset) {
  var oldOffset = offset
  var q = {}

  q.name = name.decode(buf, offset)
  offset += name.decode.bytes

  q.type = types.toString(buf.readUInt16BE(offset))
  offset += 2

  q.class = buf.readUInt16BE(offset)
  offset += 2

  var qu = !!(q.class & QU_MASK)
  if (qu) q.class &= ~QU_MASK

  question.decode.bytes = offset - oldOffset
  return q
}

question.encode = function (q, buf, offset) {
  var oldOffset = offset

  name.encode(q.name, buf, offset)
  offset += name.encode.bytes

  buf.writeUInt16BE(types.toType(q.type), offset)
  offset += 2

  buf.writeUInt16BE(q.class === undefined ? 1 : q.class, offset)
  offset += 2

  question.encode.bytes = offset - oldOffset
  return q
}

question.encodingLength = function (q) {
  return name.encodingLength(q.name) + 4
}

var encodeList = function (list, enc, buf, offset) {
  for (var i = 0; i < list.length; i++) {
    enc.encode(list[i], buf, offset)
    offset += enc.encode.bytes
  }
  return offset
}

var encodingLengthList = function (list, enc) {
  var len = 0
  for (var i = 0; i < list.length; i++) len += enc.encodingLength(list[i])
  return len
}

exports.encode = function (result) {
  result.qdcount = result.questions ? result.questions.length : 0
  result.ancount = result.answers ? result.answers.length : 0
  result.nscount = result.authorities ? result.authorities.length : 0
  result.arcount = result.additionals ? result.additionals.length : 0

  var len = header.encodingLength(result)
  len += encodingLengthList(result.questions || [], question)
  len += encodingLengthList(result.answers || [], answer)
  len += encodingLengthList(result.authorities || [], answer)
  len += encodingLengthList(result.additionals || [], answer)

  var buf = new Buffer(len)
  header.encode(result, buf, 0)

  var offset = header.encode.bytes
  offset = encodeList(result.questions || [], question, buf, offset)
  offset = encodeList(result.answers || [], answer, buf, offset)
  offset = encodeList(result.authorities || [], answer, buf, offset)
  offset = encodeList(result.additionals || [], answer, buf, offset)

  return buf
}

var decodeList = function (list, enc, buf, offset) {
  for (var i = 0; i < list.length; i++) {
    list[i] = enc.decode(buf, offset)
    offset += enc.decode.bytes
  }
  return offset
}

exports.decode = function (buf) {
  var result = header.decode(buf, 0)
  var offset = header.decode.bytes

  offset = decodeList(result.questions = new Array(result.qdcount), question, buf, offset)
  offset = decodeList(result.answers = new Array(result.ancount), answer, buf, offset)
  offset = decodeList(result.authorities = new Array(result.nscount), answer, buf, offset)
  offset = decodeList(result.additionals = new Array(result.arcount), answer, buf, offset)

  return result
}
