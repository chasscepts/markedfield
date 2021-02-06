const fs = require('fs');
const path = require('path');
const { dialog, Menu } = require('electron').remote;
const markdown = require('marked');
const appConfig = require('./app.config');
const editorConfig = require('./editor.config');
const dirTree = require('directory-tree');
const logger = require('./logger');

(function(){
  let editor, display, fileBrowser, isFileBrowserOpen = false;

  const fileFilter = { extensions: /\.md/ };

  const main = () => {
    editor = document.querySelector('#editor');
    display = document.querySelector('#display');
    fileBrowser = document.querySelector('#file-browser');

    setupDragging();
    setupKeyBindings();
    setupEditor();
    setupFileBrowser();
    setupWorkspace();
    setupMenu();
  }

  const setupDragging = () => {
    let resizing = false,
      resizer = document.querySelector('#resizer'),
      left = resizer.previousElementSibling,
      parent = left.parentNode,
      right = resizer.nextElementSibling,
      leftRect = left.getBoundingClientRect,
      parentRect = resizer.parentElement.getBoundingClientRect,
      startX = 0,
      leftWidth = 0;

    const down = evt => {
      startX = evt.clientX;
      leftWidth = left.getBoundingClientRect().width;
      resizing = true;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);

      resizer.style.cursor = 'col-resize';
      document.body.style.cursor = 'col-resize';
    }

    const up = () => {
      resizing = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);

      resizer.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
    }

    const move = evt => {
      if(!resizing) return;
      const x = evt.clientX;
      left.style.width = `${ 100 * (leftWidth + (x - startX) + 5) / resizer.parentNode.getBoundingClientRect().width }%`;
    }
    
    resizer.addEventListener('mousedown', down);
  }

  const setupKeyBindings = () => {
    document.onkeyup = e => {
      if(e.ctrlKey){
        if(e.key === 's' || e.key === 'S'){
          save();
          e.preventDefault();
        }

        return;
      }
    }
  }

  const refreshDisplay = () => {
    display.innerHTML = markdown(editor.value);
  }

  const setupEditor = () => {
    editor.addEventListener('input', refreshDisplay);
    editor.addEventListener('keydown', e => {
      if(e.key == 'Tab'){
        e.preventDefault();
        addTab();
      }
    });
  }

  const setupFileBrowser = () => {
    document.querySelector('#aside-open-btn').addEventListener('click', openFileBrowser);
    document.querySelector('#aside-close-btn').addEventListener('click', closeFileBrowser);
  }

  const setupWorkspace = () => {
    if(appConfig.dir){
      openFolder(appConfig.dir, false);
      openFileBrowser();
    }
  }

  const setupMenu = () => {
    const isMac = process.platform === 'darwin'

    const template = [
      // { role: 'appMenu' }
      ...(isMac ? [{
        label: app.name,
        submenu: [
          //{ role: 'about' },
          //{ type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }] : []),
      // { role: 'fileMenu' }
      {
        label: 'File',
        submenu: [
          { 
            label: 'New',
            click: createNew
          },
          { 
            label: 'Open Workspace',
            click: openWorkSpace
          },
          { type: 'separator'},
          { 
            label: 'Save', 
            click: save
          },
          { 
            label: 'Save As', 
            click: saveAs
          },
          { 
            label: 'Export', 
            submenu: [
              {
                label: 'HTML',
                click: exportToHtml
              }
            ]
          },
          { type: 'separator'},
          { 
            label: 'Toggle File Browser',
            click: toggleFileBrowser
          },
          { type: 'separator'},
          isMac ? { role: 'close' } : { role: 'quit' }
        ]
      },
      // { role: 'editMenu' }
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
            { type: 'separator' },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' },
                { role: 'stopSpeaking' }
              ]
            }
          ] : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
        ]
      },
      // { role: 'viewMenu' }
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      // { role: 'windowMenu' }
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          ...(isMac ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ] : [
            { role: 'close' }
          ])
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  const createNew = () => {
    let file = dialog.showSaveDialogSync(null, {defaultPath: appConfig.dir, filters: [{name: 'Markdown', extensions: ['md']}]});
    if(!file) return;
    let { dir } = path.parse(file);
    appConfig.dir = dir;
    appConfig.file = file;
    editor.value = '';
    refreshDisplay();
    if(save()){
      openFolder(dir, false);
    }
  }

  const openWorkSpace = () => {
    let folder = dialog.showOpenDialogSync(null, { defaultPath: appConfig.dir, properties: ['openDirectory'] });
    if(!folder) return;
    folder = folder[0];
    openFolder(folder);
  }

  const openFolder = (dir, save = true) => {
    const tree = dirTree(dir, fileFilter);
    addFileTreeBranch(tree);
    if(save){
      appConfig.dir = dir;
      appConfig.save();
    }
  }

  const save = () => {
    if(!appConfig.file){
      saveAs();
      return;
    }
    let content = document.querySelector('#editor').value || '';
    try{
      fs.writeFileSync(appConfig.file, content);
      return true;
    }
    catch(err){
      dialog.showMessageBox(null, { type: 'error', buttons: ['Cancel'], message: 'An error occured while saving file'});
      logger.error(err);
    }
    return false;
  }

  const saveAs = () => {
    let file = dialog.showSaveDialogSync(null, {defaultPath: appConfig.dir, filters: [{name: 'Markdown', extensions: ['md']}]});
    if(!file) return;
    let { dir } = path.parse(file);
    appConfig.dir = dir;
    appConfig.file = file;
    appConfig.save();
    if(save()){
      openFolder(appConfig.dir, false);
    }
  }

  const exportToHtml = () => {
    const file = dialog.showSaveDialogSync(null, { defaultPath: appConfig.dir, filters: [{name: 'Html', extensions: ['html', 'htm']}] });
    if(!file) return;
    const content = display.innerHTML;
    try{
      fs.writeFileSync(file, content);
    }
    catch(err){
      dialog.showMessageBox(null, { type: 'error', buttons: ['Cancel'], message: 'An error occured while exporting file'});
      logger.error(err);
    }
  }

  const closeFileBrowser = () => {
    fileBrowser.classList.remove('open');
    isFileBrowserOpen = false;
  }

  const openFileBrowser = () => {
    fileBrowser.classList.add('open');
    isFileBrowserOpen = true;
  }

  const toggleFileBrowser = (menuItem) => {
    isFileBrowserOpen? closeFileBrowser() : openFileBrowser();
  }

  const openFile = path => {
    try{
      const content = fs.readFileSync(path);
      editor.value = content;
      refreshDisplay();
      appConfig.file = path;
      appConfig.save();
    }
    catch(err){
      dialog.showMessageBox(null, { type: 'error', buttons: ['Cancel'], message: 'There was an error reading from the specified path. Pleae check if file still exists.'});
      logger.error(err);
    }
  }

  const addTab = () => {
    const value = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    editor.value = value.substring(0, start) + editorConfig.tab + value.substring(end);

    // put caret at right position again
    editor.selectionStart = editor.selectionEnd = start + editorConfig.tab.length;
  }

  const addFileTreeBranch = (branch, parentNode) => {
    //  Lets handle only the type we know
    const type = branch.type;
    if(!(type === 'file' || type === 'directory')) return;
    if(!parentNode){
      parentNode = document.querySelector('#file-browser-body');
      parentNode.innerHTML = '';
    }
    const branchPanel = document.createElement('div');
    branchPanel.className = 'tree-branch-panel';
    const namePanel = document.createElement('div');
    namePanel.className = 'name';
    namePanel.innerHTML = branch.name;
    branchPanel.append(namePanel);
    if(type === 'file'){
      namePanel.classList.add('file');
      namePanel.onclick = () => {
        openFile(branch.path);
      }
    }
    else{
      namePanel.classList.add('folder');
      const panel = document.createElement('div');
      panel.className = 'children';
      branch.children.forEach(child => {
        addFileTreeBranch(child, panel);
      });
      branchPanel.appendChild(panel);
      let height = 0, collapsed = false;
      console.log(height);
      namePanel.onclick = () => {
        if(!height){
          height = panel.clientHeight + 'px'
        }
        collapsed = !collapsed;
        namePanel.classList.toggle('collapsed');
        panel.style.height = collapsed? 0 : height;
      }
    }
    parentNode.append(branchPanel);
  }

  //document.addEventListener('DOMContentLoaded', main);
  main();
})();