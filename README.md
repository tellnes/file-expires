[![build status](https://secure.travis-ci.org/tellnes/file-expires.png)](http://travis-ci.org/tellnes/file-expires)
# File expires

Get a notification when a file expires or changes.


## Example

```js
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

```

## Install

    npm install file-expires


## Licence

MIT
