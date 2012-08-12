var createFileExpirer = require('./')

var file = createFileExpirer('https://github.com/favicon.ico')

var content

file.on('expires', function() {
  console.log('expired')
  file.readFile(function(err, c) {
    content = c
  })
})

file.on('change', function() {
  console.log('changed')
})


file.readFile(function(err, c) {
  content = c
})
