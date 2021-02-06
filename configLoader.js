const fs = require('fs');
const path = require('path');
const cwd = process.cwd();



exports.load = file => {
  const configFile = path.join(cwd, file);

  let config = {};
  
  try{
    let temp = fs.readFileSync(configFile);
    temp = JSON.parse(temp);
    if (typeof temp == "object" && !(temp instanceof Array) && temp != null){
      config = temp
    }
  }
  catch(err) {}

  const keys = Object.keys(config);
  const temp = Object.create(null);

  config.save = () => {
    return new Promise((resolve, reject) => {
      try{
        keys.forEach(key => {
          temp[key] = config[key];
        });
        fs.writeFileSync(configFile, JSON.stringify(temp));
        resolve();
      }
      catch(err){
        reject(err);
      }
    });
  }

  return config;
}

exports.save = file => {
  const configFile = path.join(cwd, file);
}