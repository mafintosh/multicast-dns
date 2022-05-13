const os = require('os')

function defaultInterface () {
  const networks = os.networkInterfaces()
  const names = Object.keys(networks)

  for (let i = 0; i < names.length; i++) {
    const net = networks[names[i]]
    for (let j = 0; j < net.length; j++) {
      const iface = net[j]
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        if (os.platform() === 'darwin' && names[i] === 'en0') { return iface.address }
        return '0.0.0.0'
      }
    }
  }

  return '127.0.0.1'
}

function allInterfaces () {
  const networks = os.networkInterfaces()
  const names = Object.keys(networks)
  const res = []

  for (let i = 0; i < names.length; i++) {
    const net = networks[names[i]]
    for (let j = 0; j < net.length; j++) {
      const iface = net[j]
      if (iface.family === 'IPv4' || iface.family === 4) {
        res.push(iface.address)
        // could only addMembership once per interface (https://nodejs.org/api/dgram.html#dgram_socket_addmembership_multicastaddress_multicastinterface)
        break
      }
    }
  }

  return res
}

module.exports = {
  allInterfaces: allInterfaces,
  defaultInterface: defaultInterface
}
