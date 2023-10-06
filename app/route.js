const fs = require('fs');

const {PubSub} = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');

const formValidator = require('./form_validator');
const photoModel = require('./photo_model');

const dataZip = require('./dataZip');
const moment = require('moment');

function route(app) {

  app.get('/', (req, res) => {

    const tags = req.query.tags;
    const tagmode = req.query.tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      invalidParameters: false,
      signedUrls: false
    };

    // if no input params are passed in then render the view with out querying the api
    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    // validate query parameters
    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }
    const handlePhotos = async (photos) => {
      ejsLocalVariables.photos = photos;
      ejsLocalVariables.searchResults = true;

      function find(tags, tagmode) {
        return dataZip.find((elem) => {
          if(elem.tags === tags && elem.tagmode == tagmode) {
            return true;
          }
          return false;
        })
      }

      console.log(dataZip)
  
      const zip = find(tags, tagmode);

      console.log(zip)

      if(zip) {

        console.log('zip',process.env.STORAGE_BUCKET)
  
        const options = { 
          action: 'read',
          expires: moment().add(2, 'days').unix() * 1000
        };

        let storage = new Storage();
      
        const signedUrls = await storage
          .bucket(process.env.STORAGE_BUCKET)
          .file(zip.name)
          .getSignedUrl(options)
        ;

        console.log(signedUrls[0])

        ejsLocalVariables.signedUrls = signedUrls[0];

      }

      return res.render('index', ejsLocalVariables);
    };

    // get photos from flickr public feed api
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(handlePhotos)
      .catch(error => {
        console.log(error)
        return res.status(500).send({ error });
      });

  });

  app.post('/zip', (req, res) => {

    /* ---------- data validation ---------- */

    const tags = req.body.tags;
    const tagmode = req.body.tagmode;

    /* ---------- data process ---------- */


    fs.readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8', async (err, data) => {

      if (err) {
        console.error(err);
        return;
      }
  
      data = JSON.parse(data)
  
      let projectid = data.project_id;
  
      const pubSubClient = new PubSub({projectid});
      const topic = await pubSubClient.topic('dmii2-7');

      let message = JSON.stringify({
        tags: tags,
        tagmode: tagmode
      });

      topic.publishMessage({data: Buffer.from(message)});
    
    });    

    return res.status(200).send({ "success": "Zip in progress !" });

  });

  // app.get('/getZip', async (req, res) => {

  //   const tags = req.body.tags;
  //   const tagmode = req.body.tagmode;



  //   console.log(signedUrls);
  
  // })

}


module.exports = route;
