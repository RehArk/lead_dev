// Imports the Google Cloud client library
const fs = require('fs');

const {PubSub} = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');

const photoModel = require('./photo_model');

const https = require('https');
const request = require('request');
const ZipStream = require('zip-stream');

// Creates a client; cache this for further use
var pubSubClient = null;
var subscription = null;

async function getImages(data) {

  const ejsLocalVariables = {
    tagsParameter: data.tags,
    tagmodeParameter: data.tagmode,
    photos: [],
    searchResults: false,
    invalidParameters: false
  };
  
  await photoModel
    .getFlickrPhotos(data.tags, data.tagmode)
    .then(photos => {
      ejsLocalVariables.photos = photos
      return ejsLocalVariables
    })
  ;

  return ejsLocalVariables.photos;

}

function downloadImage(tempFolder, image) {

  const fileurl = fs.createWriteStream(tempFolder + '/' + image.title.replaceAll(' ', '_') + '.jpg');

  https.get(image.media.b, (response) => {
    response.pipe(fileurl);
  });

}

function uuidv4() {

  const crypto = require('crypto');

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );

}

async function zipImage(stream, queue) {

  var zip = new ZipStream()
  zip.pipe(stream)

  function addNextFile() {

    var elem = queue.shift()
    var stream = request(elem.media.b)
    var name = elem.title.replaceAll(' ', '_') + '.jpg';

    zip.entry(stream, { name: name }, err => {
      
      if(err) {
        throw err;
      }
        
      if(queue.length == 0) {
        zip.finalize()
        return;
      }

      addNextFile()
        
    })

  }

  addNextFile();

}

async function pushOnDrive(temp_file) {
  
  let storage = new Storage();

  const file = await storage
    .bucket('dmii2023bucket')
    .file('public/users/' + temp_file)
  ;

  const stream = file.createWriteStream({
    metadata: {
      contentType: 'application/zip',
      cacheControl: 'private'
    },
    resumable: false
  });

  return stream;

}

// Create an event handler to handle messages
async function messageHandler (message) {

  let data = JSON.parse(message.data);
  let images = await getImages(data);

  images = images.slice(0, 10);
  
  let file_name = uuidv4();

  const stream = await pushOnDrive(file_name);
  zipImage(stream, images);
  
    
  // fs.mkdirSync(tempFolder);

  // for(let image of images) {
  //   // downloadImage(tempFolder, image);
  // }

  message.ack();

};

async function listenForMessages(nameOfTopicAndSubscription) {  

  // References an existing subscription
  subscription = pubSubClient.subscription(nameOfTopicAndSubscription);

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

}

fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8', (err, data) => {

    if (err) {
      // console.error(err);
      return;
    }

    data = JSON.parse(data)

    let projectid = data.project_id;

    pubSubClient = new PubSub({projectid});
    listenForMessages('dmii2-7')

});