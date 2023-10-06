const fs = require('fs');

const {PubSub} = require('@google-cloud/pubsub');

const formValidator = require('./form_validator');
const photoModel = require('./photo_model');
const { request } = require('http');

function route(app) {

  app.get('/', (req, res) => {

    const tags = req.query.tags;
    const tagmode = req.query.tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      invalidParameters: false
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

    // get photos from flickr public feed api
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
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

}

module.exports = route;
