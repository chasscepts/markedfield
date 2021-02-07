const fs = require('fs');
const path = require('path');
const { dialog, Menu } = require('electron').remote;
const markdown = require('marked');
const hljs = require('highlight.js');
const preferences = require('./user-preferences');
const dirTree = require('directory-tree');
const cssLoader = require('./css-loader');
const logger = require('./logger');

markdown.setOptions({
  renderer: new markdown.Renderer(),
  highlight: function(code, language) {
    const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
    return hljs.highlight(validLanguage, code).value;
  },
  pedantic: false,
  gfm: true,
  breaks: false,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false
});

(function(){
  let editor, display, editorTheme, fileBrowser, isFileBrowserOpen = false;

  const fileFilter = { extensions: /\.md/ };

  const main = () => {
    editorTheme = preferences.editorTheme || 'standard'
    editor = document.querySelector('#editor');
    display = document.querySelector('#display');
    fileBrowser = document.querySelector('#file-browser');

    loadcss();
    setupDragging();
    setupKeyBindings();
    setupEditor();
    setupFileBrowser();
    setupWorkspace();
    setupMenu();

  }

  const loadcss = () => {
    cssLoader.load('highlight.js/styles/github.css');
  }

  const setupDragging = () => {
    let resizing = false,
      resizer = document.querySelector('#resizer'),
      left = resizer.previousElementSibling,
      right = resizer.nextElementSibling,
      startX = 0,
      leftWidth = 0,
      parentWidth = 0;

    const down = evt => {
      startX = evt.clientX;
      leftWidth = left.getBoundingClientRect().width;
      parentWidth = resizer.parentNode.getBoundingClientRect().width;
      resizing = true;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);

      resizer.style.cursor = 'col-resize';
      document.body.style.cursor = 'col-resize';

      resizer.parentNode.classList.add('resizing');
    }

    const up = () => {
      resizing = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);

      resizer.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');

      resizer.parentNode.classList.remove('resizing');
    }

    const move = evt => {
      if(!resizing) return;
      const x = evt.clientX;
      left.style.width = `${ 100 * ((leftWidth + (x - startX)) / parentWidth) }%`;
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

  const setupEditor = () => {
    editor.className = editorTheme;
    preferences.editorSpellCheckOn = preferences.editorSpellCheckOn? true : false;
    editor.setAttribute('spellcheck', preferences.editorSpellCheckOn);
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
    if(preferences.currentDirectory){
      openFolder(preferences.currentDirectory, false);
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
      // { label: Editor}
      {
        label: 'Editor',
        submenu: [
          {
            label: 'Themes',
            submenu: [
              {label: 'Standard', type: 'radio', click: changeEditorTheme, checked: editorTheme === 'standard'},
              {label: 'Dark', type: 'radio', click: changeEditorTheme, checked: editorTheme === 'dark'},
            ]
          },
          { label: 'Spell Check', type: 'checkbox', click: toggleEditorSpellCheck, checked: preferences.editorSpellCheckOn}
        ]
      }
      ,
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
  
  const refreshDisplay = () => {
    display.innerHTML = markdown(editor.value);
  }

  const clearEditor = () => {
    editor.value = '';
    display.innerHTML = '';
  }

  const changeEditorTheme = item => {
    let className = 'standard'
    switch(item.label){
      case 'Dark':
        className = 'dark';
        break;
    }

    editor.className = className;
    preferences.editorTheme = className;
  }

  const toggleEditorSpellCheck = item => {
    preferences.editorSpellCheckOn = item.checked;
    editor.setAttribute('spellcheck', preferences.editorSpellCheckOn);
    const content = editor.value;
    clearEditor();
    editor.value = content;
    refreshDisplay();
  }

  const createNew = () => {
    let file = dialog.showSaveDialogSync(null, {defaultPath: preferences.currentDirectory, filters: [{name: 'Markdown', extensions: ['md']}]});
    if(!file) return;
    let { dir } = path.parse(file);
    preferences.currentDirectory = dir;
    preferences.currentFile = file;
    clearEditor();
    if(save()){
      openFolder(dir, false);
    }
  }

  const openWorkSpace = () => {
    let folder = dialog.showOpenDialogSync(null, { defaultPath: preferences.currentDirectory, properties: ['openDirectory'] });
    if(!folder) return;
    folder = folder[0];
    openFolder(folder);
  }

  const openFolder = (dir, save = true) => {
    let selected = null, fileFound = false;

    const tree = dirTree(dir, fileFilter);
    addFileTreeBranch(tree);
    if(save){
      preferences.currentDirectory = dir;
    }
    if(selected){
      selected.click();
    }
    else{
      clearEditor();
    }

    function addFileTreeBranch(branch, parentNode){
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
          if(selected){
            selected.classList.remove('selected');
          }
          selected = namePanel;
          selected.classList.add('selected');
          openFile(branch.path);
        }
        if(branch.path === preferences.currentFile){
          selected = namePanel;
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
  }

  const save = () => {
    if(!preferences.currentFile){
      saveAs();
      return;
    }
    let content = document.querySelector('#editor').value || '';
    try{
      fs.writeFileSync(preferences.currentFile, content);
      return true;
    }
    catch(err){
      dialog.showMessageBox(null, { type: 'error', buttons: ['Cancel'], message: 'An error occured while saving file'});
      logger.error(err);
    }
    return false;
  }

  const saveAs = () => {
    let file = dialog.showSaveDialogSync(null, {defaultPath: preferences.currentDirectory, filters: [{name: 'Markdown', extensions: ['md']}]});
    if(!file) return;
    let { dir } = path.parse(file);
    preferences.currentDirectory = dir;
    preferences.currentFile = file;
    if(save()){
      openFolder(preferences.currentDirectory, false);
    }
  }

  const exportToHtml = () => {
    const file = dialog.showSaveDialogSync(null, { defaultPath: preferences.currentDirectory, filters: [{name: 'Html', extensions: ['html', 'htm']}] });
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

  const toggleFileBrowser = () => {
    isFileBrowserOpen? closeFileBrowser() : openFileBrowser();
  }

  const openFile = path => {
    try{
      const content = fs.readFileSync(path);
      editor.value = content;
      refreshDisplay();
      preferences.currentFile = path;
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
    editor.value = value.substring(0, start) + preferences.editorTab + value.substring(end);

    // put caret at right position again
    editor.selectionStart = editor.selectionEnd = start + preferences.editorTab.length;
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

  window.onunload = () => {
    preferences.save().catch(err => logger.error(err));
  }
  main();
})();