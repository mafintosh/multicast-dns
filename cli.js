#!/usr/bin/env node

const mdns = require('./')()
const path = require('path')
const os = require('os')

const announcing = process.argv.indexOf('--announce') > -1

if (process.argv.length < 3) {
  console.error('Usage: %s <hostname>', path.basename(process.argv[1]))
  process.exit(1)
}
const hostname = process.argv[2]

if (announcing) {
  const ip = getIp()
  mdns.on('query', function (query, rinfo) {
    query.questions.forEach(function (q) {
      if (q.name === hostname) {
        console.log('Responding %s -> %s', q.name, ip)
        mdns.respond({
          answers: [{
            type: 'A',
            name: q.name,
            data: ip
          }]
        }, { port: rinfo.port })
      }
    })
  })
} else {
  mdns.on('response', function (response) {
    response.answers.forEach(function (answer) {
      if (answer.name === hostname) {
        console.log(answer.data)
        process.exit()
      }
    })
  })

  mdns.query(hostname, 'A')

  // Give responses 3 seconds to respond
  setTimeout(function () {
    console.error('Hostname not found')
    process.exit(1)
  }, 3000)
}

function getIp () {
  const networks = os.networkInterfaces()
  let found = '127.0.0.1'

  Object.keys(networks).forEach(function (k) {
    const n = networks[k]
    n.forEach(function (addr) {
      if ((addr.family === 'IPv4' || addr.family === 4) && !addr.internal) {
        found = addr.address
      }
    })
  })

  return found
}
