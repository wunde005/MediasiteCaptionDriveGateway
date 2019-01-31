/**
 *
 * 
 * 
 */
//

var config
const readline = require('readline');
const {
  google
} = require('googleapis')
var Client = require('node-rest-client').Client;
const fs = require('fs');
const moment = require('moment')
var path = require("path");

xml2js = require('xml2js');
fsxml = require('fs');
var parser = new xml2js.Parser();
var JsonDB = require('node-json-db');

const moveSRT = true
const moveMP4 = true

var isWin = process.platform === 'win32' //is this running on windows
if (isWin) {
  var p = process.cwd() + "\\"
  var configp = '\\..\\config\\'
}
else {
  var p = process.cwd() + '/'
  var configp = '/../config/'
}
console.log("cwd path:", p)
msauth = require(__dirname + configp + "mediasite_auth.json")
fs.readFile(p + 'config.json', 'utf8', function readFileCallback(err, data) {
  if (err) {
    console.log(err);
  } else {
    config = JSON.parse(data); //now it an object
   console.log("loaded config.json")

   if(config.Mediasite_Auth_file){
    console.log("loading "+config.Mediasite_Auth_file)
    const MEDIASITE_AUTH = __dirname + configp + config.Mediasite_Auth_file
    fs.readFile(MEDIASITE_AUTH, 'utf8', function readFileCallback(err, data) {
      if (err) {
        console.log(err);
      } else {
        msauth = JSON.parse(data); //now it an object
        args.headers.sfapikey = msauth.sfapikey
        args.headers.Authorization = msauth.Authorization
      }
    })
  
  }
  else{
    const MEDIASITE_AUTH = __dirname + configp + 'mediasite_auth.json'
    console.log("loading "+MEDIASITE_AUTH)
    fs.readFile(MEDIASITE_AUTH, 'utf8', function readFileCallback(err, data) {
      if (err) {
        console.log(err);
      } else {
        //console.log(data)
        msauth = JSON.parse(data); //now it an object
        args.headers.sfapikey = msauth.sfapikey
        args.headers.Authorization = msauth.Authorization
      }
    })
  
  }
  
  }
}) //config.folders_enabled
const CLIENT_SECRET = __dirname + configp + 'client_secret.json'

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = '..\\config\\credentials.json';




var client = new Client();
var msauth



var db = new JsonDB(p + "presentations", true, true);

var currentmon = (new Date()).getMonth()

if (!isWin) {
  var Inotify = require('inotify').Inotify;
  var inotify = new Inotify(); //persistent by default, new Inotify(false) //no persistent 
} else {
  console.log("Windows detected! No inotify")
}

var fslog = require('fs')
var nodemailer = require('nodemailer');

var presentationarray = []



//write log info to files
var plog = function (sLog, presentation) {
  if (presentation != null) {
    if (presentation.hasOwnProperty('id')) {
      //console.log(presentation.id)
      if (!presentation.hasOwnProperty('log')) {
        presentation.log = presentation.id + '.log'
      }
      if (!transcripts.hasOwnProperty(presentation.id)) {
        //init transcript
        transcripts[presentation.id] = {}
      }

      if (!transcripts[presentation.id].hasOwnProperty('log')) {
        //init log
        transcripts[presentation.id].log = []
      }

      //console.log(transcripts[presentation.id].log.length+' '+sLog)
      transcripts[presentation.id].log.push(sLog)
      //console.log(typeof sLog);
      fslog.appendFile(presentation.log, sLog + '\n', function (err) {
        if (err) {
          throw err;
        }
      });
    }
  } else {
    //console.log("NO PRESENTATION---------------"+sLog)
  }
  //console.log(typeof sLog);
  if ((typeof sLog) == "object") {
    fslog.appendFile(option.logfile, sLog.name + ':' + JSON.stringify(sLog), function (err) {
      if (err) throw err;
    });
  } else {
    fslog.appendFile(option.logfile, sLog + '\n', function (err) {
      if (err) throw err;
    });
  }
  console.log(sLog)
}

var monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];


//default enables
var enable = {
  name: 'enable',
  post: true,
  caption: true,
  cleanup: 'move'
}

//default options
var option = {
  name: 'option',
  post: {
    headers: {
      'X-Custom-Header': 'Caption'
    }
  },
  archive: 'archive',
  logfile: 'caption.log'
}

var auth = JSON.parse('{}')
var enable_file = {}
var option_file = {}


try {
  //console.log(p + 'enable.json')
  enable_file = require(p + 'enable.json')
} catch (e) {
  plog("Notification: enable.json file not found. Using defaults.")
  //plog(enable)
}

try {
  option_file = require(p + 'option.json')
} catch (e) {
  plog("Notification: option.json file not found. Using defaults.")
}

//copy file settings over default settings
for (var attributename in enable_file) {
  enable[attributename] = enable_file[attributename]
}
for (var attributename in option_file) {
  option[attributename] = option_file[attributename]
}

var processing = []

var transcripts = []


//skip mailer code if mail properties aren't set
if (option.hasOwnProperty('mail')) {
  //var transporter = nodemailer.createTransport(ses(option.mail.nodemailer));
  var transporter = nodemailer.createTransport(option.mail.nodemailer);
  var sendNotification = function (presentation) {
    var contents = []
    transcripts[presentation.id].log.forEach(function (l_entry) {
      contents += l_entry + '\n'
    });
    presentation.log
    transporter.sendMail({
      from: option.mail.from,
      to: option.mail.to,
      subject: 'MSCaption:' + process.env.USER + ':' + presentation.PresentationTitle,
      text: 'JSON:\n' + JSON.stringify(presentation, null, 3) + '\n\nLOG:\n' + contents
    }).then(function (info) {

    }).catch(function (err) {
      console.log(err);
    });
  }
  var sendUploadNotification = function (presentation) {
    //presentation.log
    pFolder = 'default'
    pFoldertmp = 'folder-' + presentation.ParentFolderName
    if(!(option['mail'][pFoldertmp] == null)){
      pFolder = pFoldertmp
      console.log("folder options found")
    }
    if( option['mail'][pFolder] === undefined){
      console.log("undefined "+pFolder)
      return
    }
    
    if( option['mail'][pFolder].toUpload == null){
      //console.log("to")
      txt_to = "to"
      toaddr = option['mail'][pFolder].to
    }
    else{
      //console.log("toUpload")
      txt_to = "toUpload"
      toaddr = option['mail'][pFolder].toUpload
    }
    if( option['mail'][pFolder].fromUpload == null){
      //console.log("from")
      txt_from = "from"
      fromaddr = option['mail'][pFolder].from
    }
    else{
      //console.log("fromUpload")
      txt_from = "fromUpload"
      fromaddr = option['mail'][pFolder].fromUpload
    }
    //presentation.gdrivefolderid = data.id
                              //presentation.gdrivefoldername
    //uploadtxt = "\nPlease upload SRT file name " + presentation.srtfilename + " to " + "\"" + presentation.gdrivefoldername + "\" https://drive.google.com/drive/u/0/folders/" + presentation.gdrivefolderid + "\n"
    //"ParentFolderName": "Test test",
   //"ParentFolderId": "572ac9bbd7954bdcae91421ac88f0b2d14",
   plog(presentation.id + ":UploadNotification:"+presentation.PresentationTitle+":folder:" + pFolder + ":to:"+txt_to+":"+toaddr+":from:"+txt_from+":"+fromaddr,presentation)
     
   //plog(presentation.id + ":UploadNotification:"+presentation.PresentationTitle+" sent to:"+toaddr+" sent from:"+fromaddr,presentation)
    transporter.sendMail({
      from: fromaddr,
      to: toaddr,
      subject: config.foldername_root + ': "' + presentation.PresentationTitle + '" uploaded to Google Drive',
      text: 'Presentation: "' + presentation.PresentationTitle + '"\nCourse: "' + presentation.ParentFolderName + '"\n\nVideo Link: https://drive.google.com/file/d/' + presentation.gdriveid + '/view?usp=sharing' + "\n\nPlease upload SRT file named: \"" + presentation.srtfilename + "\"\n to Google Drive folder \"" + presentation.gdrivefoldername + "\" https://drive.google.com/drive/u/0/folders/" + presentation.gdrivefolderid + "\n"
    }).then(function (info) {

    }).catch(function (err) {
      console.log(err);
    });
  }


  var sendSRTNotification = function (presentation) {
    //presentation.log
    pFolder = 'default'
    pFoldertmp = 'folder-' + presentation.ParentFolderName
    
    if( option['mail'][pFolder] === undefined ){
      console.log("undefined "+pFolder)
      return
    }

    if(!(option['mail'][pFoldertmp] == null)){
      pFolder = pFoldertmp
    }
    if( option['mail'][pFolder].toSRT == null){
      txt_to = "to"
      toaddr = option['mail'][pFolder].to
    }
    else{
      toaddr = option['mail'][pFolder].toSRT
      txt_to = "toSRT"
    }
    if( option['mail'][pFolder].fromSRT == null){
      txt_from = "from"
      fromaddr = option['mail'][pFolder].from
    }
    else{
      txt_from = "fromSRT"
      fromaddr = option['mail'][pFolder].fromSRT
    }


    plog(presentation.id + ":SRTNotification:"+presentation.PresentationTitle+":folder:" + pFolder + ":to:"+txt_to+":"+toaddr+":from:"+txt_from+":"+fromaddr,presentation)
    transporter.sendMail({
      from: fromaddr,
      bcc: toaddr,
      subject: config.foldername_root + ': "' + presentation.PresentationTitle + '" captioning complete',
      text: 'Presentation: "' + presentation.PresentationTitle + '"\nCourse: ' + presentation.ParentFolderName + '\n\nLink: https://mediasite.csom.umn.edu/Mediasite/Play/' + presentation.id.replace(/-/g,'') + '\n' + '\n\n' 
    }).then(function (info) {

    }).catch(function (err) {
      console.log(err);
    });
  }
} else {
  var sendNotification = function (presentation) {
    return
  }
  var sendUploadNotification = function (presentation) {
    return
  }
  var sendSRTNotification = function (presentation) {
    return
  }
}

var archiveFiles = function (presentation, logonly, cb) {
  if (presentation == null) {
    cb(1)
    return;
  }
  var filelist = []

  if (!fs.existsSync(p + option.archive)) {
    fs.mkdirSync(p + option.archive);
  }
  if (logonly) {
    filelist.push(presentation.log)
  } else {
    filelist.push(presentation.manifest)
    filelist.push(presentation.inputfile)
  }
  filelist.forEach(function (file) {
    plog(presentation.id + ":archive:Moving File:" + file)
    fs.rename(file, p + option.archive + '/' + path.basename(file), function (err) {
      if (err) {
        plog(presentation.id + ':ERROR:' + err)
        //throw err;
      }
    });
  });
  cb()
}

//clean up after processing
var cleanup = function (presentation, cb) {
  var fsclean = require('fs')
  var fs_json = require('fs');

  var AllOut = {}
  //save all stored info into json file
  if (enable.AllOut) {
    presentation.allout_file = presentation.id + '_all.json'
    AllOut[presentation.id] = transcripts[presentation.id]
    plog(presentation.id + ':cleanup:Saving All data to ' + presentation.allout_file, presentation);
    if (enable.transcript2_json_file) {
      fs_json.writeFile(presentation.id + '_all.json', JSON.stringify(AllOut, null, 4), function (err) {
        if (err) {
          plog(err, presentation);
        } else {

        }
      });
    }
  }
  //make list of files to move/delete
  var filelist = []

  if ('allout_file' in presentation) {
    filelist.push(presentation.allout_file)
  }

  //single slice stores filename in parts object and audiofile
  if (transcripts[presentation.id].SliceCnt > 1) {
    if ('audiofile' in presentation) {
      filelist.push(presentation.audiofile)
    }
  }
  if ('inputfile' in presentation) {
    filelist.push(presentation.inputfile)
  }
  if ('outputfile' in presentation) {
    filelist.push(presentation.outputfile)
  }
  if ('manifest' in presentation) {
    filelist.push(presentation.manifest)
  }
  if ('outputfile_json' in presentation) {
    filelist.push(presentation.outputfile_json)
  }
  if ('outputfile_srt' in presentation) {
    filelist.push(presentation.outputfile_srt)
  }
  if ('log' in presentation) {
    filelist.push(presentation.log)
  }
  if (enable.cleanup == 'delete') {
    plog(presentation.id + ":cleanup:Deleteing Files", presentation)
  } else if (enable.cleanup == 'move') {
    var endtime = new Date().getTime()
    plog(presentation.id + ":cleanup:Moving Files" + ":tstamp=" + endtime, presentation)
    if ('startt' in presentation) {
      var difftime = endtime - presentation.startt;
      var runtime = new Date(difftime)
      presentation.difftime = difftime
      presentation.time = zeroPad(runtime.getUTCHours(), 2) + ':' + zeroPad(runtime.getUTCMinutes(), 2) + ':' + zeroPad(runtime.getUTCSeconds(), 2) + '.' + zeroPad(difftime % 1000, 3)

      plog(presentation.id + ":time=" + difftime + " (" + presentation.time + ")", presentation)
    }
    sendNotification(presentation)

    if (!fs.existsSync(p + option.archive)) {
      fs.mkdirSync(p + option.archive);
    }


    filelist.forEach(function (file) {
      plog(presentation.id + ":cleanup:Moving File:" + file)
      fsclean.rename(file, p + option.archive + '/' + path.basename(file), function (err) {
        if (err) {
          plog(presentation.id + ':ERROR:' + err)
          //throw err;
        }
      });
    });
  }
  var TransIndex = transcripts.indexOf(presentation.id)

  if (index > -1) {
    trascripts.splice(TransIndex, 1)
  }

  var index = processing.indexOf(presentation.id)
  if (index > -1) {
    processing.splice(index, 1)
  }
}

//var fs = require('fs');


//get filesize
function getFilesizeInBytes(filename) {
  var stats = fs.statSync(filename)
  var fileSizeInBytes = stats["size"]
  return fileSizeInBytes
}

function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}

//post transcript srt file to callback
function post(transcript, presentation, cb) {
  plog(presentation.id + ':post:Starting', presentation)
  if (enable.post) {
    var needle = require('needle')
    plog(presentation.id + ':post:url=' + presentation.CallbackURL, presentation)
    needle.post(presentation.CallbackURL, transcript, option.post, function (err, resp) {
      if(err){
        plog(presentation.id + ':post:ERROR:'+err, presentation)
      }
      if (presentation.id) {
        db.delete('/' + presentation.id)
        sendSRTNotification(presentation)
        archiveFiles(presentation, true, () => {
          plog(presentation.id + ':archiveFiles:logonly:done')//, presentation)
        })
      } else {
        plog(presentation.id + ':post:ERROR:presetnation.id not valid', presentation)
      }
      //cleanup(presentation,cb)
    });
  } else {
    plog(presentation.id + ':post:Skipping', presentation)
    //cleanup(presentation,cb)
  }
}


scanforfiles = function () {
  var badManifest = false
  plog(':scanforfile:Starting:tstamp=' + (new Date().getTime()) + ':time=' + moment(new Date()).format('YYYYMMDD-HH:mm:ss'))
  //plog(path.basename(event.name, ".mp4") + ":dirWatch:MP4File=" + event.name + ":tstamp=" + (new Date().getTime()))
  fs.readdir(p, function (err, files) {
    if (err) {
      plog(':ERROR:' + err)
      throw err;
    }
    //plog(files)
    files.map(function (file) {
      return path.join(p, file);
    }).filter(function (file) {
      return fs.statSync(file).isFile();
    }).forEach(function (file) {
      //don't need to read manifest until upload srt
      //if(false){
      if (path.extname(file) == ".manifest") {
        fsxml.readFile(file, function (err, data) {
          parser.parseString(data, function (err, result) {
            var badManifest = false
            var presentation = {}
            presentation.manifest = path.basename(file)
            presentation.id = path.basename(presentation.manifest, '.manifest')
            plog(presentation.id + ":scanforfiles:Found Manifest", presentation)

            if (result == null) {
              badManifest = true
            } else {

              if (!('MediasiteCaptioningSubmission' in result)) {
                badManifest = true
              } else {

                for (var att in result.MediasiteCaptioningSubmission) {
                  if (att === '$') { } 
                  else presentation[att] = result.MediasiteCaptioningSubmission[att][0]
                }

                if (!('MediasitePresentationId' in result.MediasiteCaptioningSubmission)) {
                  badManifest = true
                } else if (processing.indexOf(result['MediasiteCaptioningSubmission']['MediasitePresentationId'][0]) == -1) {
                  presentation.id = presentation.MediasitePresentationId
                  presentation.Title = result['MediasiteCaptioningSubmission']['PresentationTitle'][0]
                  plog(presentation.id + ':Manifest:' + presentation.Title, presentation)

                  for (var i = 0, len = files.length; i < len; i++) {
                    var inputfile = ""
                    if ((presentation.id + ".mp4") == files[i]) {
                      inputfile = presentation.id + ".mp4"

                    } else if ((presentation.id + ".mp3") == files[i]) {
                      inputfile = presentation.id + ".mp3"
                    }

                    if (inputfile != "") {

                      presentation.inputfile = inputfile
                      
                      getPresentationInfo(presentation.id, (data) => {
                        if(config.folders_enabled){
                          presentation.ParentFolderName = data.ParentFolderName
                          presentation.ParentFolderId = data.ParentFolderId
                          presentation.Title = data.Title
                        }
                        else{
                          presentation.ParentFolderName = ""
                          presentation.ParentFolderId = config.folderid_root
                          //presentation.Title = data.Title
                        }
                        fs.readFile(CLIENT_SECRET, (err, content) => {
                          if (err) return console.log('Error loading client secret file:', err);
                          // Authorize a client with credentials, then call the Google Drive API.
                          authorize(JSON.parse(content), (auth) => {
                
                            folderForData(auth, config.folderid_root, presentation.ParentFolderName, (data) => {
                              plog(presentation.id + ':folderForData:FolderName:' + data.name + ':FolderId:' + data.id, presentation)
                
                              presentation.gdrivefolderid = data.id
                              presentation.gdrivefoldername = data.name
                              
                              var newfilename = presentation.Title + '_' + presentation.id + ".mp4"
                              var srtfilename = presentation.Title + '_' + presentation.id + ".srt"
                              presentation.newfilename = newfilename
                              presentation.srtfilename = srtfilename
                              plog(presentation.id + ':newmp4name:filename:' + newfilename, presentation)
                              uploadMP4file(auth, presentation.inputfile, newfilename, data.id, (doner) => {
                
                                presentation.gdriveid = doner.id
                                
                                sendUploadNotification(presentation)
                
                                plog(presentation.id + ':uploadMP4files:gdriveid:' + presentation.gdriveid, presentation)
                                db.push("/" + presentation.id, presentation);
                                archiveFiles(presentation, false, () => {
                                  //console.log("archived")
                                  plog(presentation.id + ':archiveFiles:done', presentation)
                                })
                              })
                            })
                          })
                        })
                      })
                    }
                  }
                }
              }
            }
            if (badManifest) {
              plog(presentation.id + ":Manifest:Bad Manifest File", presentation)
              cleanup(presentation, cb)
            }
          });
        });
      }
      var fsrename = require('fs');
      if (enable.manifest_rename) {
        fsrename.rename(file, file + ".old", function (err) {
          if (err) plog('ERROR: ' + err, presentation);
        });
      }
    });
  });
}


//inotify isn't supported for windows. skip this section if windows is detected
if (!isWin) {

  var callback = function (event) {
    var mask = event.mask;
    var type = mask & Inotify.IN_ISDIR ? 'directory ' : 'file ';
    if (event.name) {
      type += ' ' + event.name + ' ';
    } else {
      type += ' ';
    }
    if (mask & Inotify.IN_CLOSE_WRITE) {
      if (path.extname(event.name) == ".srt") {
        plog(path.basename(event.name, ".srt") + ":dirWatch:SRTFile=" + event.name + ":tstamp=" + (new Date().getTime()))
        //scanforfiles();
      } else if (path.extname(event.name) == ".mp4")
        plog(path.basename(event.name, ".mp4") + ":dirWatch:MP4File=" + event.name + ":tstamp=" + (new Date().getTime()))
      else if (path.extname(event.name) == ".mp3")
        plog(path.basename(event.name, ".mp3") + ":dirWatch:MP3File=" + event.name + ":tstamp=" + (new Date().getTime()))
      else if (path.extname(event.name) == ".manifest") {
        plog(path.basename(event.name, ".manifest") + ":dirWatch:ManifestFile=" + event.name + ":tstamp=" + (new Date().getTime()))
        scanforfiles();
      }

    }
  }


  var home_dir = {
    // Change this for a valid directory in your machine. 
    path: p,
    watch_for: Inotify.IN_OPEN | Inotify.IN_CLOSE,
    callback: callback
  };


  //start watching for added files 
  var home_watch_descriptor = inotify.addWatch(home_dir);
}

var args = {
  headers: {
    Accept: 'application/json;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip,deflate,sdch',
    'Accept-Language': 'en-US,en;q=0.8'
  }
};

function getPresentationInfo(presentationid, done) {
  
  if(config.folders_enabled){
   client.get(msauth.uri + "/api/v1/Presentations('" + presentationid + "')?$select=full", args, function (data, response) {
      done(data)
    });
  }
  else{
    done()
  }
}



// Load client secrets from a local file.
function checkForSRTfiles(done) {
  fs.readFile(CLIENT_SECRET, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), (auth) => {
      const drive = google.drive({
        version: 'v3',
        auth
      });
      plog(':checkForSRTfiles:scanning:' + moment(new Date()).format('YYYYMMDD-HH:mm:ss'))
      plog(':checkForSRTfiles:scanning:root_folder:' + config.foldername_root + ":" + config.folderid_root)
      //console.log("scanning: root folder")
      srtRecursive(auth, { id: config.folderid_root, name: "rootfolder" }, () => console.log("check for srt file done"))

    });

  });
  //console.log("remaing:",PresentationsRemaining((p)=>{console.log(p)}))
}

function reloadManifest(done) {
  fs.readFile(CLIENT_SECRET, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), (auth) => {
      const drive = google.drive({
        version: 'v3',
        auth
      });
      plog(':reloadManifest:scanning:' + moment(new Date()).format('YYYYMMDD-HH:mm:ss'))
      plog(':reloadManifest:scanning:root_folder:' + config.folderid_root)
      //console.log("scanning: root folder")
      ManifestRecursive(auth, { id: config.folderid_root, name: "rootfolder" }, () => console.log("check for srt file done"))

    });

  });
  //console.log("remaing:",PresentationsRemaining((p)=>{console.log(p)}))
}

function ManifestRecursive(auth, folder, done) {
  ManifestFileTask(auth, folder, () => { })
  listFolders(auth, folder.id, (directorylist) => {
    //console.log("directory list:",directorylist)
    if (directorylist) {
      directorylist.map((directory) => {
        //console.log("scanning:", directory.name)
        plog(':reloadManifest:scanning:' + directory.name + ':' + directory.id)
        ManifestRecursive(auth, directory, () => console.log("srtRecursive done"))
      })
    }
  })
}

async function ManifestFileTask(auth, folder, done) {
  findFiles(auth, folder.id, '.mp4', (srtfilelist) => {
    if (srtfilelist) {
      srtfilelist.map((srtfile) => {
        //console.log(srtfile.name)
        var presentation = {}
        var fullfilename = srtfile.name
        var filename = fullfilename.substring(fullfilename.lastIndexOf("_") + 1)
        var presentationid = filename.substring(0, filename.lastIndexOf("."))

        //plog(':srtFileTask:srtfile:' + srtfile.name + ':srtid:' + srtfile.id +':ERROR:presenation not found in db')

        var fullfilename = srtfile.name
        var filename = fullfilename.substring(fullfilename.lastIndexOf("_") + 1)
        var presentationid = filename.substring(0, filename.lastIndexOf("."))
        presentation.id = presentationid
        manifestname = presentationid + ".manifest"
        plog(presentation.id + ':ManifestFileTask:file:' + manifestname, presentation)
        if (isWin) {
          fullmanifestname = p + 'archive\\' + manifestname
        }
        else {
          fullmanifestname = p + 'archive/' + manifestname
        }
        console.log(fullmanifestname)
        return readManifest(fullmanifestname)
      })
    } //new
  })
}


function readManifest(file, done) {
  fsxml.readFile(file, function (err, data) {
    if (err != null) {
      console.log(err)
      return err
    }
    parser.parseString(data, function (err, result) {
      var badManifest = false
      var presentation = {}
      presentation.manifest = path.basename(file)
      presentation.id = path.basename(presentation.manifest, '.manifest')
      //presentation.Title = path.basename(presentation.manifest,)
      plog(presentation.id + ":scanforfiles:Found Manifest", presentation)

      if (result == null) {
        badManifest = true
      } else {

        if (!('MediasiteCaptioningSubmission' in result)) {
          badManifest = true
        } else {

          for (var att in result.MediasiteCaptioningSubmission) {
            if (att === '$') { } //console.log("question mark")
            else presentation[att] = result.MediasiteCaptioningSubmission[att][0]
            //console.log("att",att,presentation[att])
          }


          if (!('MediasitePresentationId' in result.MediasiteCaptioningSubmission)) {
            badManifest = true
          } else if (processing.indexOf(result['MediasiteCaptioningSubmission']['MediasitePresentationId'][0]) == -1) {
            //var index = 
            presentation.id = presentation.MediasitePresentationId
            //processing.push(presentation.id)
            //plog(presentation.id + ":processing=" + processing.length + ":tstamp=" + (new Date().getTime()), presentation)
            //presentation.startt = new Date().getTime()

            plog(presentation.id + ':Manifest:' + result['MediasiteCaptioningSubmission']['PresentationTitle'][0], presentation)
            //var audiofile = presentation.id + ".ogg"
            plog(presentation.id + ':uploadMP4files:gdriveid:' + presentation.gdriveid, presentation)
            db.push("/" + presentation.id, presentation);

          }
        }
        if (badManifest) {
          plog(presentation.id + ":Manifest:Bad Manifest File", presentation)
          cleanup(presentation, cb)
        }
      }
    });
  });
}

async function srtRecursive(auth, folder, done) {
  srtFileTask(auth, folder, () => { })
  listFolders(auth, folder.id, (directorylist) => {
    //console.log("directory list:",directorylist)
    if (directorylist) {
      directorylist.map((directory) => {
        //console.log("scanning:", directory.name)
        plog(':checkForSRTfiles:scanning:' + directory.name + ':' + directory.id)
        srtRecursive(auth, directory, () => console.log("srtRecursive done"))
      })
    }
  })
}

async function createFolder(auth, folderid, foldername, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  drive.files.create({
    resource: {
      name: foldername,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [folderid]
    },
    fields: 'id, name'
  }, function (err, {
    data
  }) {
      if (err) {
        // Handle error
        console.error(err);
      } else {
        done(data)
      }
    });
}

function PresentationInfo(presentationid, done) {
  try {
    var presentation = db.getData('/' + presentationid)
  } catch (error) {
    var presentation = null
  }
  if (presentation == null) {
    plog(':srtFileTask:srtfile:' + presentationid + ':ERROR:presenation not found in db')
    console.log(db.getData('/'))

    //console.log("presentation info not found in db")
  }
  done(presentation)
}

function PresentationsRemaining(done) {
  try {
    var presentations = db.getData('/')
  } catch (error) {
    var presentations = null
  }
  if (presentations == null) {
    plog(':srtFileTask:srtfile:' + ':ERROR:presenation not found in db')
    //console.log(db.getData('/'))

    //console.log("presentation info not found in db")
  }
  var pinfo = []
  var lcount = 0
  for (var pid in presentations) {
    //console.log('pid',pid)
    var p = db.getData('/' + pid)
    lcount++
    //console.log('p',p)
    pinfo.push({ 'name': p.PresentationTitle, 'id': p.id });
  }
  //return keys;

  done(pinfo)
  return lcount
}


async function srtFileTask(auth, folder, done) {
  findFiles(auth, folder.id, '.srt', (srtfilelist) => {
    if (srtfilelist) {
      srtfilelist.map((srtfile) => {
        //console.log(srtfile.name)
        var fullfilename = srtfile.name
        var filename = fullfilename.substring(fullfilename.lastIndexOf("_") + 1)
        var presentationid = filename.substring(0, filename.lastIndexOf("."))

        try {
          var presentation = db.getData('/' + presentationid)
        } catch (error) {
          var presentation = null
        }
        if (presentation == null) {
          plog(':srtFileTask:srtfile:' + srtfile.name + ':srtid:' + srtfile.id + ':ERROR:presenation not found in db')

          //console.log("presentation info not found in db")
        } else {
          plog(presentation.id + ':srtFileTask:srtfile:' + srtfile.name + ':srtid:' + srtfile.id, presentation)
          downloadData(auth, srtfile.id, (data, err) => {
            //downloadFile(auth, srtfile.id, srtfile.name, (err) => {
            if (err != null) {
              console.log(err)
            }
            if (data == null) {
              console.log("data is null")
            } else {
              //console.log(data)
              //check for mp4
              plog(presentation.id + ':downloadData:size:' + data.length, presentation)
              //console.log("found srt file:", srtfile.name)
              var fullfilename = srtfile.name
              var filename = fullfilename.substring(fullfilename.lastIndexOf("_") + 1)
              var presentationid = filename.substring(0, filename.lastIndexOf("."))

              //var presentationid = 
              try {
                var PresentationCallBackUrl = db.getData('/' + presentationid)
              } catch (error) {
                var PresentationCallBackUrl = null
              }
              if (PresentationCallBackUrl) {

                post(data, PresentationCallBackUrl, () => {
                  //plog(presentation.id + ':folderForData:FolderName:'+data.name+':FolderId:'+data.id, presentation)
                  console.log("post")
                })
              }

              if (moveSRT) { //skip move 
                //console.log("moving file:", srtfile.name)
                movefile(auth, srtfile.id, folder.id, (err) => {
                  //deletefile(auth,srtfile.id,(err) => {
                  if (err != null) {
                    console.log(err)
                  } else (
                    plog(presentation.id + ':movesrt:' + srtfile.name, presentation)
                    //console.log("file moved:", srtfile.name)
                  )


                  var mp4name = presentationid + ".mp4"
                  //console.log("looking for: mp4s mp4name:", mp4name)
                  plog(presentation.id + ':scanning for mp4:' + mp4name, presentation)
                  findFiles(auth, folder.id, ".mp4", (mp4Filelist) => {
                    //console.log(mp4Filelist)
                    if (mp4Filelist) {
                      mp4Filelist.map((mp4file) => {
                        console.log(mp4file.name, " ", mp4name, " ", mp4file.name.lastIndexOf(mp4name) > -1)
                        if (mp4file.name.lastIndexOf(mp4name) > -1) {
                          console.log(mp4file.name,mp4file.id)
                          if (moveMP4) { //skip move
                            movefile(auth, mp4file.id, folder.id, (err) => {
                              //deletefile(auth,srtfile.id,(err) => {
                              if (err != null) {
                                console.log(err)
                              } else {
                                plog(presentation.id + ':moving mp4:' + mp4name + ':' + mp4file.id, presentation)
                                var delfolder = folder.id
                                //console.log("delfolder:",delfolder)
                                //makesure not root?
                                if (delfolder != config.folderid_root) {
                                  findFiles(auth, delfolder, null, (Filelist) => {
                                    //console.log("filelist:",Filelist)
                                    if (Filelist == null) {

                                      deletefile(auth, delfolder, () => {
                                        plog(presentation.id + ':delete empty folder:' + delfolder + ':' + folder.name, presentation)
                                        //console.log("folderid:",drive_folders[folder.name] )
                                        delete drive_folders[folder.name]
                                        //console.log(drive_folders)
                                        //console.log("delete folder:", folderid)
                                      })

                                    }
                                    else {
                                      console.log("not deleting folder")
                                    }
                                  })
                                }
                                else {
                                  console.log("root_folder: no delete")
                                }
                              }
                            })

                            //console.log("file moved:", mp4file.name)
                          }
                        }
                      })

                    }
                  })
                })
              } else {
                console.log("no mp4s found")
              }
            }
          })
        } //new
      })
    }
  });
  done()
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

var drive_folders = []
/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function folderForData(auth, folderid_root, foldername, filelistret) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  //console.log("name = '" + foldername + "' and mimeType = 'application/vnd.google-apps.folder' and parents in '" + folderid_root + "' and trashed = false")
  drive.files.list({
    q: "name = '" + foldername + "' and mimeType = 'application/vnd.google-apps.folder' and parents in '" + folderid_root + "' and trashed = false",
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)'
  }, (err, response) => {
    if (err) return console.log('The API returned an error: ' + err);
    //if (!data) return console.log('The API returned an error: ');
    //console.log(response)
    var data = response.data
    //console.log("response:"+JSON.stringify(data))
    if (data.files.length > 1) {
      console.log("WARN: more than one folder returned")
    }
    const file = data.files[0];
    //console.log('file',file)
    if (file != null) {
      filelistret(file)
      }
    else if(foldername == ""){
      filelistret({"id":config.folderid_root,"name":config.foldername_root})        
    } else {
      plog(':folderForData:creatingfolder:' + foldername)
      //console.log('Folder not found. Creating new folder.');
      //console.log('drivefolder:',foldername,drive_folders['foldername'])
      if (typeof drive_folders[foldername] === 'undefined') {

        drive_folders[foldername] = null
        createFolder(auth, folderid_root, foldername, (donez) => {
          if(foldername !== ""){
            drive_folders[foldername] = donez.id
            plog(':folderForData:foldercreated:' + donez.name + ':' + donez.id)
            filelistret(donez)
          }
          else{
            plog(':folderForData:using_root:' + donez.name + ':' + donez.id)
            filelistret(donez)
          }
        })
      }


    }
  });
}



async function listFolders(auth, folderid, filelistret) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  var query = "mimeType = 'application/vnd.google-apps.folder' and parents in '" + folderid + "' and trashed = false"
  //console.log(query)
  drive.files.list({
    q: query,
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err, response) => {
    //console.log("#listfolders-response:",response)
    if (err) return console.log('The API returned an error: ' + err);
    var data = response.data
    if (data != null) {
      const files = data.files;
      if (files.length) {
        //console.log('Files:');
        filelist = files
        filelistret(filelist)
      } else {
        //console.log('No files found.');
        filelistret(null)
      }
    } else {
      console.log('listfolders datat null')
    }
    //console.log(`${data.nextPageToken}`)
  });
}



async function findFiles(auth, folderid, extension, retfilelist) {
  if (extension == null) {
    query = "parents in '" + folderid + "' and trashed = false"
  } else {
    query = "name contains '" + extension + "' and parents in '" + folderid + "' and trashed = false"
  }
  //console.log(query)
  const drive = google.drive({
    version: 'v3',
    auth
  });
  //console.log(folderid)
  drive.files.list({
    q: query,
    pageSize: 10,
    //fields: 'nextPageToken, files(*)',
    fields: 'nextPageToken, files(id, name, parents, description)',
  }, (err, response) => {
    //console.log("#findfiles-response:",response)
    if (err) return console.log('The API returned an error: ' + err);
    var data = response.data
    if (!data) return console.log('The API returned an error: ' + err);
    if (data) {
      const files = data.files;
      if (files.length) {
        retfilelist(files);

      } else {
        //console.log('No files found.',extension);
        retfilelist(null)
      }
    }
  });
}

async function findAllFiles(auth, folderid, retfilelist) {
  query = "parents in '" + folderid + "' and trashed = false"
  const drive = google.drive({
    version: 'v3',
    auth
  });
  drive.files.list({
    q: query,
    pageSize: 10,
    fields: 'nextPageToken, files(id, name, parents, description)',
  }, (err, response) => {
    //console.log("#findfiles-response:",response)
    if (err) return console.log('The API returned an error: ' + err);
    var data = response.data
    if (!data) return console.log('The API returned an error: ' + err);
    if (data) {
      const files = data.files;
      if (files.length) {
        retfilelist(files);

      } else {
        //console.log('No files found.',extension);
        retfilelist(null)
      }
    }
  });
}


async function downloadData(auth, fileId, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  drive.files.get({
    fileId: fileId,
    mimeType: 'text/csv',
    alt: 'media'
  }, {
      //responseType: 'json'
      //responseType: 'arraybuffer'
      responseType: 'stream'
    }, function (err, response) {
      if (err) return done(err);
      data = []
      response.data.on('error', err => {
        done(err);
      }).on('end', () => {
        var b = Buffer.concat(this.data); // Create a buffer from all the received chunks
        var c = b.toString()
        done(c);

      }).on('data', (buf) => {
        data.push(buf);
      })

    });
}


async function downloadFile(auth, fileId, name, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  const dest = fs.createWriteStream(name);

  drive.files.get({
    fileId: fileId,
    mimeType: 'text/csv',
    alt: 'media'
  }, {
      responseType: 'stream'
    }, function (err, response) {
      if (err) return done(err);

      response.data.on('error', err => {
        done(err);
      }).on('end', () => {
        //console.log(dat)
        done();

      })
        .pipe(dest);
    });
}


async function deletefile(auth, fileId, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  //console.log("fileid:",fileId)
  drive.files.delete({
    fileId: fileId
  }, function (err, response) {
    if (err) return done(err);
    //console.log(response)
    done(response)
  })
}

async function movefile(auth, fileId, folderid, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  drive.files.update({
    fileId: fileId,
    addParents: config.folderid_done,
    removeParents: folderid,
    fields: 'id, parents'
  }, function (err, response) {
    if (err) return done(err);
    done()
  })
}


async function renamefile(auth, fileId, newfilename, this_presentationid, done) {
  const drive = google.drive({
    version: 'v3',
    auth
  });
  drive.files.update({
    fileId: fileId,
    resource: {
      name: newfilename,
      description: this_presentationid
    },
    fields: 'id, name, description'
  }, function (err, {
    data
  }) {
      if (err) return done(err);
      done(data)
    })
}

function uploadMP4file(auth, local_file, filename, folderid, done) {
  fs.readFile(CLIENT_SECRET, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), (auth) => {
      const drive = google.drive({
        version: 'v3',
        auth
      });
      //console.log('uploadMP4file',local_file,' ',filename,' ',folderid)
      var fileMetadata = {
        'name': filename,
        parents: [folderid]
      };
      var media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(local_file)
      };

      drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      }, function (err, file) {
        if (err) {
          console.error(err);
        } else {
          //console.log('file id: ', file.data.id)
          done(file.data)
        }
      });
    });
  });
}

//only run iff this isn't running as a module
if (require.main === module) {
  console.log('called directly');
  checkForSRTfiles(() => console.log("test done"))
  
  var countInterval = 0
  //upload_int = setInterval(() => { uploadMP4file(auth_info,"files/test.mp4","test.mp4",folderid_root, () => {console.log('upload');clearInterval(upload_int)})},10000)
  upload_int = setInterval(() => {
    console.log("countInterval:", countInterval);
    countInterval++
    if (countInterval > 10) {
      clearInterval(upload_int)
    }
    
    console.log("presentations remaining:", PresentationsRemaining(() => { }))
    
    if (PresentationsRemaining(() => { }) > 0) {
      plog(":Interval:StartCheck:" + moment(new Date()).format('YYYYMMDD-HH:mm:ss'))
      checkForSRTfiles(() => console.log("test done"))
    }
    if (isWin) {
      scanforfiles()

    }
    //getPresentationInfo('1e5c57f1e9fc48579b43f9ba1f9f180e1d',(done)=> {
     // console.log('DATA:\n' + JSON.stringify(done, null, 3)+'\n')
    //})
    //}, 1000)
    //}, 300000) //5 minute
    //}, 60000) //1 minute
  }, 20000) //1/3 minute

} else {
  console.log('running DriveCaption as Module');
}


var getKeys = function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }
  return keys;
}

exports.checkForSRTfiles = checkForSRTfiles
exports.scanforfiles = scanforfiles
exports.isWin = isWin
exports.PresentationInfo = PresentationInfo
exports.PresentationsRemaining = PresentationsRemaining
exports.reloadManifest = reloadManifest
exports.plog = plog