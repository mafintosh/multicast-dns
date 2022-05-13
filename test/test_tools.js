
var { allInterfaces, defaultInterface } = require('../tools.js')
var tape = require('tape')

tape('allInterfaces should work with this version of node', function (t) {
  const ifaces = allInterfaces()
  t.ok(ifaces.length > 0, 'allInterfaces should return an array with at least 1 element')
  t.end()
})
tape('defaultInterface should work with this version of node', function (t) {
  const defaut = defaultInterface()
  t.ok(defaut.length > 0, 'defaut should return valid ip address')
  t.end()
})
