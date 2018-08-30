var isWin = process.platform === 'win32' //is this running on windows
var p = process.cwd()+'/' 
  
var currentmon = (new Date()).getMonth()

if(!isWin){
  var Inotify = require('inotify').Inotify;
  var inotify = new Inotify(); //persistent by default, new Inotify(false) //no persistent 
}
else{
  console.log("Windows detected! No inotify")
}

var fslog = require('fs')
var nodemailer = require('nodemailer');
var ses = require('nodemailer-ses-transport');

var presentationarray = []

//write log info to files
var plog = function(sLog,presentation){
  if(presentation != null) {
    if(presentation.hasOwnProperty('id')) {
       //console.log(presentation.id)
       if(!presentation.hasOwnProperty('log')){
         presentation.log = presentation.id + '.log'
       }
       if(!transcripts.hasOwnProperty(presentation.id)){
          //init transcript
          transcripts[presentation.id] = {}
        }
        
        if(!transcripts[presentation.id].hasOwnProperty('log')){
            //init log
            transcripts[presentation.id].log = [] 
          }
      
       //console.log(transcripts[presentation.id].log.length+' '+sLog)
       transcripts[presentation.id].log.push(sLog)
       //console.log(typeof sLog);
       fslog.appendFile(presentation.log,sLog+'\n',function(err){
         if(err) {
            throw err;
          }
       });
    }
  }
  else{
    //console.log("NO PRESENTATION---------------"+sLog)
  }
  //console.log(typeof sLog);
  if((typeof sLog) == "object"){
  fslog.appendFile(option.logfile, sLog.name + ':' + JSON.stringify(sLog), function (err) {
     if (err) throw err;
  }
  );
  }
  else{
    fslog.appendFile(option.logfile, sLog+'\n', function (err) {
     if (err) throw err;
  }
  );
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
  post:{ 
    headers:{ 
        'X-Custom-Header': 'Caption' 
      }
    },
  archive: 'archive',
  logfile: 'caption.log'
}

var auth = JSON.parse('{}')
var enable_file = {}
var option_file = {}


try{
  enable_file = require(p + 'enable.json')
}
catch(e){
  plog("Notification: enable.json file not found. Using defaults.")
  plog(enable)
}

try{
  option_file = require(p + 'option.json')  
}
catch(e){
  plog("Notification: option.json file not found. Using defaults.")
  plog(option)
}

/*
try{
  auth_file = require(p + 'auth.json')  
}
catch(e){
  plog("Notification: auth.json file not found. Quiting")
  return
}
*/

//copy file settings over default settings
for(var attributename in enable_file) {  enable[attributename] = enable_file[attributename] }
for(var attributename in option_file) {  option[attributename] = option_file[attributename] }
//for(var attributename in auth_file) {  auth[attributename] = auth_file[attributename] }

var processing = []

var transcripts = []


//skip mailer code if mail properties aren't set
if(option.hasOwnProperty('mail')){
  //var transporter = nodemailer.createTransport(ses(option.mail.nodemailer));
  var transporter = nodemailer.createTransport(option.mail.nodemailer);
  var sendNotification = function(presentation){
    var fs = require('fs');
    var contents = []
    transcripts[presentation.id].log.forEach(function(l_entry){
      contents += l_entry + '\n'
    });
    presentation.log
    transporter.sendMail({
      from: option.mail.from,
      to: option.mail.to,
      subject: 'MSCaption:' + process.env.USER + ':' + presentation.PresentationTitle,
      text: 'JSON:\n' + JSON.stringify(presentation,null,3) + '\n\nLOG:\n' + contents
    }).then(function(info){

    }).catch(function(err){
      console.log(err);
    });
  }
}
else{
  var sendNotification = function(presentation){
    return
  }
}

var archiveFiles = function(presentation,cb){
//  var fsclean = require('fs')
  if(presentation == null) {
    cb(1)
    return;
  }
  var filelist = []

  if (!fs.existsSync(p + option.archive)){
        fs.mkdirSync(p + option.archive);
    }
  
  filelist.push(presentation.manifest)
  filelist.push(presentation.inputfile)
  filelist.push(presentation.log)
  filelist.forEach(function(file) { 
      plog(presentation.id+":archive:Moving File:"+file)
      fs.rename(file, p + option.archive+'/'+path.basename(file), function (err) {
        if (err) {
          plog(presentation.id+':ERROR:'+err)
          //throw err;
        }
    });
  });
  //db.delete('/'+presentation.id)
  cb()
}

//clean up after processing
var cleanup = function(presentation,cb){
  var fsclean = require('fs')
  var fs_json = require('fs');

  var AllOut = {}
  //save all stored info into json file
  if(enable.AllOut){
    presentation.allout_file = presentation.id+'_all.json'
    AllOut[presentation.id]= transcripts[presentation.id]
    plog(presentation.id+':cleanup:Saving All data to '+presentation.allout_file,presentation);
    if(enable.transcript2_json_file){ 
      fs_json.writeFile(presentation.id+'_all.json', JSON.stringify(AllOut, null, 4), function(err) {
        if(err) {
          plog(err,presentation);
        } else {
          
        }
      });
    }
  }
  //make list of files to move/delete
  var filelist = []

  if('allout_file' in presentation){
    filelist.push(presentation.allout_file)
  }

  //single slice stores filename in parts object and audiofile
  if(transcripts[presentation.id].SliceCnt > 1){
    if('audiofile' in presentation){
      filelist.push(presentation.audiofile)
    }
  }
/*
  presentation.parts.forEach(function(part){
    plog(presentation.id+":cleanup:Push_list:"+part.filename)
    plog(presentation.id+":cleanup:Push_list:"+part.outputfile_json)
    filelist.push(part.filename)
    filelist.push(part.outputfile_json)
  });
*/
  if('inputfile' in presentation){
    filelist.push(presentation.inputfile)
  }
  if('outputfile' in presentation){
    filelist.push(presentation.outputfile)
  }
  if('manifest' in presentation){
    filelist.push(presentation.manifest)
  }
  if('outputfile_json' in presentation){
    filelist.push(presentation.outputfile_json)
  }
  if('outputfile_srt' in presentation){
    filelist.push(presentation.outputfile_srt)
  }
  if('log' in presentation){
    filelist.push(presentation.log)
  }
  if(enable.cleanup == 'delete'){
    plog(presentation.id+":cleanup:Deleteing Files",presentation)
  }
  else if(enable.cleanup == 'move'){
    var endtime = new Date().getTime()
    plog(presentation.id+":cleanup:Moving Files" + ":tstamp="+endtime,presentation)
    if('startt' in presentation){
       var difftime = endtime - presentation.startt;
       var runtime = new Date(difftime)
       presentation.difftime = difftime
       presentation.time = zeroPad(runtime.getUTCHours(),2) + ':' + zeroPad(runtime.getUTCMinutes(),2) + ':' + zeroPad(runtime.getUTCSeconds(),2) + '.' + zeroPad(difftime % 1000,3) 
       
       plog(presentation.id+":time=" + difftime + " (" + presentation.time + ")",presentation)
    }
    sendNotification(presentation)
    
    if (!fs.existsSync(p + option.archive)){
        fs.mkdirSync(p + option.archive);
    }


    filelist.forEach(function(file) { 
      plog(presentation.id+":cleanup:Moving File:"+file)
      fsclean.rename(file, p + option.archive+'/'+path.basename(file), function (err) {
        if (err) {
          plog(presentation.id+':ERROR:'+err)
          //throw err;
        }
      });
    });
  }
  var TransIndex = transcripts.indexOf(presentation.id)
  
  if(index>-1){
    trascripts.splice(TransIndex,1)
  }
  
  var index = processing.indexOf(presentation.id)
  if(index > -1){
    processing.splice(index,1)
  }
}

fs = require('fs');

var path = require("path");

xml2js = require('xml2js');
fsxml = require('fs');
var parser = new xml2js.Parser();

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
function post(transcript,presentation,cb){
  plog(presentation.id+':post:Starting',presentation)
  if(enable.post){
     var needle = require('needle')
     plog(presentation.id+':post:url='+presentation.CallbackURL,presentation)
     //console.log(option.post)
     //console.log(transcript)
     needle.post(presentation.CallbackURL,transcript,option.post,function(err, resp){
       cleanup(presentation,cb)
     }); 
  }
  else {
    plog(presentation.id+':post:Skipping',presentation)
    cleanup(presentation,cb)
  }
}


scanforfiles = function(){
  var badManifest = false
  plog(':scanforfile:Starting')
  fs.readdir(p, function (err, files) {
    if (err) {
      plog(':ERROR:'+err)
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
        if(path.extname(file) == ".manifest"){
          //console.log('basename',path.basename(file))
          //console.log('posix.basename',path.posix.basename(file))
          //console.log('dirname',path.dirname(file))
          //console.log('parse',path.parse(file))
          fsxml.readFile( file, function(err, data)   {
            parser.parseString(data, function (err, result) {
            var badManifest = false
            var presentation = {}
            presentation.manifest = path.basename(file)
            presentation.id =  path.basename(presentation.manifest,'.manifest')           

            if(result == null){
              badManifest = true
            }
            else{

              if(!('MediasiteCaptioningSubmission' in result)){
                badManifest = true
              }
              else{
                
                for(var att in result.MediasiteCaptioningSubmission){
                  if(att === '$') {}//console.log("question mark")
                  else presentation[att] = result.MediasiteCaptioningSubmission[att][0]
                  //console.log("att",att,presentation[att])
                }
                

                if(!('MediasitePresentationId' in result.MediasiteCaptioningSubmission)){
                  badManifest = true
                }
                else if(processing.indexOf(result['MediasiteCaptioningSubmission']['MediasitePresentationId'][0]) == -1){
                  //var index = 
                  presentation.id = presentation.MediasitePresentationId
                  //processing.push(presentation.id)
                  plog(presentation.id+":processing="+processing.length  + ":tstamp="+(new Date().getTime()),presentation)
                  presentation.startt =  new Date().getTime()

                  plog(presentation.id+':Manifest:'+result['MediasiteCaptioningSubmission']['PresentationTitle'][0],presentation)
                  //var audiofile = presentation.id + ".ogg"
                  for(var i = 0, len = files.length; i < len; i++){
                    var inputfile = "" 
                    if((presentation.id + ".mp4") == files[i]){
                      inputfile = presentation.id + ".mp4"
                      
                    }
                    else if((presentation.id + ".mp3") == files[i]){
                      inputfile = presentation.id + ".mp3"
  		                //log(presentation,pid + ".mp3 ")
  		              }
  		              if(inputfile != ""){
                      presentation.inputfile = inputfile
                      //console.log(presentation.inputfile)
                      //presentation.audiofile = audiofile
                      //console.log(presentation)
                        //  AddPresentation(presentation)
                        db.push("/"+presentation.id,presentation);
                        //upload mp4 to drive



                      if(presentationarray.length > 3){
                        //db.delete("/00c515ff-f18f-4b90-88d9-5352f2047be7");
                        //db.delete("/f81effb3-72f9-4275-ad89-7cd7d9dc4e0b");
                        //db.delete("/22481389-6eb6-418b-8813-e5c2ed414c34");
                        //db.delete("/04df243e-4f90-466f-a610-2601a373043a");
                        
                        //only happens after post

                        try {
                            var data = db.getData("/00c515ff-f18f-4b90-88d9-5352f2047be7");
                          } catch(error) {
                            // The error will tell you where the DataPath stopped. In this case test1
                            // Since /test1/test does't exist.
                            //console.error(error);
                          };


                        archiveFiles(data, (err)=>{
                          //if(!err)                          //db.getData('/00c515ff-f18f-4b90-88d9-5352f2047be7'),() => {
                          //console.log("archiving 00c515ff-f18f-4b90-88d9-5352f2047be7")
                        })
                        /*
                        archive(presentationarray[0],()=> {
                          console.log("archiving",presentationarray[0].id)
                        })
                        */                        
                        //console.log(RemovePresentation('00c515ff-f18f-4b90-88d9-5352f2047be7'))
                        //console.log(RemovePresentation('f81effb3-72f9-4275-ad89-7cd7d9dc4e0b'))
                        //console.log(RemovePresentation('22481389-6eb6-418b-8813-e5c2ed414c34'))
                        //console.log(RemovePresentation('04df243e-4f90-466f-a610-2601a373043a'))
                      //console.log(db.getData('/00c515ff-f18f-4b90-88d9-5352f2047be7/CallbackURL'))
                      //PresentationCallBackUrl('00c515ff-f18f-4b90-88d9-5352f2047be7')
                      //PresentationCallBackUrl('22481389-6eb6-418b-8813-e5c2ed414c34')
                      }
                      //plog("copy to gdrive")
                    }
                    //console.log('pushing')
                      //presentationarray.push(presentation)
                      //console.log(presentationarray.length)
                      
                  }
                }
              }
            }
            if(badManifest){
              plog(presentation.id+":Manifest:Bad Manifest File",presentation) 
              cleanup(presentation,cb)
            } 
          });
          });
        }
      var fsrename = require('fs');
      if(enable.manifest_rename){
        fsrename.rename(file,file + ".old",function(err){
          if(err) plog('ERROR: ' + err,presentation);
        });
      }
    });
  });
  //RemovePresentation('00c515ff-f18f-4b90-88d9-5352f2047be7')
  }


var JsonDB = require('node-json-db');
// The second argument is used to tell the DB to save after each push
// If you put false, you'll have to call the save() method.
// The third argument is to ask JsonDB to save the database in an human readable format. (default false)
var db = new JsonDB("myDataBase", true, true);

var ModifyingPresentations = false

function AddPresentation(presentation){
    var found = false
    while(ModifyingPresentations == true){}
    //console.log(i,presentationarray[i].id)
    ModifyingPresentations = true
    var i = presentationarray.length-1
    
    for (; i>=0;i--){
        console.log(i,presentationarray[i].id)
        if (presentationarray[i].id === presentation.id) {
            //console.log(presentationarray.splice(i, 1))
          
          found = true
        }
        //id: '00c515ff-f18f-4b90-88d9-5352f2047be7'
    }
    if(!found){
      //console.log("pushing:",presentation.id)
      presentationarray.push(presentation)
      /*
      var waiting = true
      while(waiting==true) {
        if(writingPresentation == false){
          waiting = false
        }
        console.log("AddPresentation",writingPresentation)
      }
      */
      //ModifingPresentations = true
      
      let data = JSON.stringify(presentationarray, null, 3);
      
      fs.writeFile('presentations.json', data, 'utf8', (err) => {  
      if (err) throw err;
        console.log('Data written to file');
        writingPresentation = false
      
      }
      );
    }
    else{
      //console.log("found:",presentation.id)
    }
    ModifyingPresentations = false
}


function RemovePresentation(presentationid){
  //console.log(presentationarray.length)
  //while(writingPresentation==true) {}
  while(ModifyingPresentations == true){}
    //console.log(i,presentationarray[i].id)
    ModifyingPresentations = true
    
  for(var i = presentationarray.length-1;i>=0;i--){
    //console.log(presentationarray[i])
    console.log(i,presentationarray[i].id)
    if(presentationarray[i].id === presentationid){
      var removed = presentationarray.splice(i,1)
      /*
      while(writingPresentation==true) {
        console.log("remove",writingPresentation)
      }
    */
      writingPresentation = true
      let data = JSON.stringify(presentationarray, null, 3);
      fs.writeFile('presentations.json', data, 'utf8', (err) => {  

      if (err) throw err;
        console.log('Data written to file');
        writingPresentation = false
      
      }
      );
      ModifyingPresentations = false
      return removed
    }
  }
  ModifyingPresentations = false
  return null

}

function PresentationCallBackUrl(presentationid){
  //console.log(presentationarray.length)
  for(var i = presentationarray.length-1;i>=0;i--){
    //console.log(presentationarray[i])
    if(presentationarray[i].id === presentationid){
      //console.log(presentationarray[i].CallbackURL)
      return presentationarray[i].CallbackURL
    }
  }
  return(null)
}


//inotify isn't supported for windows. skip this section if windows is detected
if(!isWin){
  
  var callback = function(event) {
          var mask = event.mask;
          var type = mask & Inotify.IN_ISDIR ? 'directory ' : 'file ';
          if (event.name) {
              type += ' ' + event.name + ' ';
          } else {
              type += ' ';
          }
          if (mask & Inotify.IN_CLOSE_WRITE){
             //log(presentation,"check for manifest")
             //log(presentation,path.extname(event.name))     
             /*
             if(path.extname(event.name) == ".manifest"){
                plog(path.basename(event.name,".manifest") + ":dirWatch:ManifestFile=" + event.name  + ":tstamp="+(new Date().getTime()))
                scanforfiles();
             }
             */

             if(path.extname(event.name) == ".srt"){
                plog(path.basename(event.name,".srt") + ":dirWatch:SRTFile=" + event.name  + ":tstamp="+(new Date().getTime()))
                //scanforfiles();
             }
             else if(path.extname(event.name) == ".mp4")
                plog(path.basename(event.name,".mp4") + ":dirWatch:MP4File=" + event.name  + ":tstamp="+(new Date().getTime()))
             else if(path.extname(event.name) == ".mp3")
                plog(path.basename(event.name,".mp3") + ":dirWatch:MP3File=" + event.name  + ":tstamp="+(new Date().getTime()))
             else if(path.extname(event.name) == ".manifest"){
                plog(path.basename(event.name,".manifest") + ":dirWatch:ManifestFile=" + event.name  + ":tstamp="+(new Date().getTime()))
             }
             
         } 
      }


  var home_dir = {
      // Change this for a valid directory in your machine. 
      path:      p,
      watch_for: Inotify.IN_OPEN | Inotify.IN_CLOSE,
      callback:  callback
  };


  //start watching for added files 
  var home_watch_descriptor = inotify.addWatch(home_dir);
}



scanforfiles();

