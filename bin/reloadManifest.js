var isWin = process.platform === 'win32' //is this running on windows
if(isWin){
  var p = process.cwd() + "\\"
}
else{
  var p = process.cwd() + '/'
}
console.log(__filename, __dirname )

const test = require(__dirname + '/DriveCaption.js')
//const moment = require('moment')
test.reloadManifest(()=>{
    console.log("done")
})