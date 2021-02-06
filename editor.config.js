const loader = require('./configLoader');
const file = 'editor.config.json';
const config = loader.load(file);

if(!config.tab){
  config.tab = '  ';
}

module.exports = config;