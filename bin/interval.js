const dc = require(__dirname + '/DriveCaption.js')
const moment2 = require('moment')

var countInterval = 0
dc.scanforfiles()
upload_int = setInterval(() => {
  console.log("countInterval:", countInterval);
  countInterval++
  /*
  if (countInterval > 10) {
    clearInterval(upload_int)
 }
 */
  if (dc.PresentationsRemaining(() => { }) > 0) {
    dc.plog(":Interval:StartCheck:" + moment2(new Date()).format('YYYYMMDD-HH:mm:ss'))
    dc.checkForSRTfiles(() => console.log("test done"))
  }
  
  if (dc.isWin) {
    dc.scanforfiles()
  }
  //}, 1000)
  //}, 300000) //5 minute
  //}, 60000) //1 minute
  //}, 20000) //1/3 minute
}, 900000)
