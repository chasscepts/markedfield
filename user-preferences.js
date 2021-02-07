const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { app } = require('electron').remote;

const createConfigFromUserData = () => {
  let config = {}, preferencesPath;
  const filename = 'preferences.json';

  try{
    const userPath = app.getPath('userData');
    if(userPath){
      preferencesPath = path.join(userPath, filename);
      if(fs.existsSync(preferencesPath)){
        const raw = fs.readFileSync(preferencesPath, 'utf8');
        const temp = JSON.parse(raw);
        if (typeof temp == "object" && !(temp instanceof Array) && temp != null){
          config = temp
        }
      }
    }
  }
  catch(err){
    logger.error(err);
  }
  
  const keys = Object.keys(config);
  const temp = Object.create(null);

  const methods = ['save'];
  
  config.save = () => {
    return new Promise((resolve, reject) => {
      if(!preferencesPath){
        reject('User data path was not properly initialized!');
        return;
      }
      try{
        Object.keys(config).forEach(key => {
          if(methods.indexOf(key) < 0){
            temp[key] = config[key];
          }
        });
        fs.writeFileSync(preferencesPath, JSON.stringify(temp));
        resolve();
      }
      catch(err){
        reject(err);
      }
    });
  }

  return config;
}

const createConfigFromLocalStorage = () => {
  let config = {};
  const key = 'PREFERENCES';
  const raw = localStorage.getItem(key);
  if(raw){
    try{
      const temp = JSON.parse(temp);
      if (typeof temp == "object" && !(temp instanceof Array) && temp != null){
        config = temp
      }
    }
    catch(err){
      logger.error(err);
    }
  }
  
  const keys = Object.keys(config);
  const temp = Object.create(null);
  
  config.save = () => {
    return new Promise((resolve, reject) => {
      keys.forEach(key => {
        temp[key] = config[key];
      });
      localStorage.setItem(key, JSON.stringify(temp));
      resolve();
    });
  }

  return config;
}

const config = createConfigFromUserData();

config.editorTab = config.editorTab || '  ';

module.exports = config;