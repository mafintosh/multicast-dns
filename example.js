var local = require('os').hostname() + '.local'

var mdns = require('./')()

mdns.on('warning', function (err) {
  console.log(err.stack)
})

mdns.on('response', function (response) {
  console.log('got a response packet:', response)
})

mdns.on('query', function (query) {
  console.log('got a query packet:', query)
  // send a response for 'your-own-hostname.local'
  if (query.questions.length && query.questions[0].name === local) {
    mdns.respond({
      answers: [{
        name: 'my-service',
        type: 'SRV',
        data: {
          port: 6666,
          weigth: 0,
          priority: 10,
          target: local
        }
      }, {
        name: local,
        type: 'A',
        ttl: 300,
        data: '192.168.1.5'
      }]
    })
  }
})

// lets query for an A record for 'your-own-hostname.local'
mdns.query({
  questions: [{
    name: local,
    type: 'A'
  }]
})
