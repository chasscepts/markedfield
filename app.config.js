const loader = require('./configLoader');
const file = 'app.config.json';
const config = loader.load(file);

module.exports = config;