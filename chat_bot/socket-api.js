const socket = require('socket.io-client')('http://127.0.0.1:14387')

socket.on('connect', function() {
  console.log('connected')
});

socket.on('event', function(data) {
  console.log('event')
});

socket.on('disconnect', function() {
  console.log('disconnect')
});

socket.on('error', function(err) {
  console.log('error', err);
})


module.exports = socket;
