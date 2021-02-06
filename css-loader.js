const fs = require('fs');
const path = require('path');

const imported = [];

exports.load = (id, root) => {
  return new Promise((resolve, reject) => {
    try{
      if(imported.indexOf(id) >= 0) return;
      const options = root? [root] : null;
      const file = require.resolve(id, options);
      const css = fs.readFileSync(file, 'utf8');
      const style = document.createElement('style');
      const head = document.head || document.getElementsByTagName('head')[0];
      head.append(style);
      style.setAttribute('type', 'text/css');
      style.id = id;
      if(style.styleSheet){
        style.styleSheet.cssText = css;
      }
      else{
        style.appendChild(document.createTextNode(css));
      }
      imported.push(id);
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}