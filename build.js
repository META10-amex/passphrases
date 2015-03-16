#!/usr/bin/env node

/* Passphrases | https://github.com/micahflee/passphrases
   Copyright (C) 2015 Micah Lee <micah@micahflee.com>

   Permission is hereby granted, free of charge, to any person obtaining a
   copy of this software and associated documentation files (the
   "Software"), to deal in the Software without restriction, including
   without limitation the rights to use, copy, modify, merge, publish,
   distribute, sublicense, and/or sell copies of the Software, and to
   permit persons to whom the Software is furnished to do so, subject to
   the following conditions:

   The above copyright notice and this permission notice shall be included
   in all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
   OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var fs = require('fs-extra');
var child_process = require('child_process');
var NwBuilder = require('node-webkit-builder');

// are we building a package to distribute?
var buildPackage = (process.argv[2] == '--package');
if(buildPackage) {
  // clean up from last time
  try {
    fs.removeSync('./dist');
    fs.mkdirSync('./dist');
  } catch(e) {}
}

// learn version of app
var version = JSON.parse(fs.readFileSync('./src/package.json'))['version'];

function build(options, callback) {
  var nw = new NwBuilder(options);

  nw.on('log',  console.log);
  nw.build().then(function () {
    callback();
  }).catch(function(err) {
    console.log('');
    console.log('Build complete.');
    console.log('');
    callback(err);
  });
}

// options for all platforms
var options = { files: './src/**' }

// Linux
if(process.platform == 'linux') {
  options.platforms = ['linux32', 'linux64'];

  build(options, function(err){
    if(err) throw err;
    if(buildPackage) {
      console.log('Note that there is no simple way to build source packages yet.');

      // building two .deb packages, for linux32 and linux64
      ['linux32', 'linux64'].forEach(function(arch){
        if(!arch) return;
        var pkgName = 'passphrases_' + version + '-1_{{arch}}';
        if(arch == 'linux32') pkgName = pkgName.replace('{{arch}}', 'i386');
        if(arch == 'linux64') pkgName = pkgName.replace('{{arch}}', 'amd64');

        try {
          // create directory structure
          fs.mkdirsSync('./dist/' + pkgName + '/opt');
          fs.mkdirsSync('./dist/' + pkgName + '/usr/bin');
          fs.mkdirsSync('./dist/' + pkgName + '/usr/share/pixmaps');
          fs.mkdirsSync('./dist/' + pkgName + '/usr/share/applications');
          fs.mkdirsSync('./dist/' + pkgName + '/DEBIAN');

          // copy binaries
          fs.copySync('./build/Passphrases/' + arch, './dist/' + pkgName + '/opt/Passphrases');

          // copy icon, .desktop
          fs.copySync('./packaging/passphrases.png', './dist/' + pkgName + '/usr/share/pixmaps/passphrases.png');
          fs.copySync('./packaging/passphrases.desktop', './dist/' + pkgName + '/usr/share/applications/passphrases.desktop');

          // create passphrases symlink
          fs.symlinkSync('../../opt/Passphrases/Passphrases', './dist/' + pkgName + '/usr/bin/passphrases');

          // write the debian control file
          var control = fs.readFileSync('./packaging/DEBIAN/control', { encoding: 'utf8' });
          control = control.replace('{{version}}', version);
          if(arch == 'linux32') control = control.replace('{{arch}}', 'i386');
          if(arch == 'linux64') control = control.replace('{{arch}}', 'amd64');
          fs.writeFileSync('./dist/' + pkgName + '/DEBIAN/control', control);

          // build .deb packages
          console.log('Building ' + pkgName + '.deb');
          child_process.exec('dpkg-deb --build ' + pkgName, { cwd: './dist' }, function(err, stdout, stderr){
            if(err) throw err;
          });

        } catch(e) { throw e; }
      });
    }
  });
}

// OSX
else if(process.platform == 'darwin') {
  options.platforms = ['osx32'];
  options.macIcns = './packaging/icon.icns';

  build(options, function(err){
    if(err) throw err;
    if(buildPackage) {
      // todo: OSX code signing
      // todo: OSX packaging
    }
  });
}

// Windows
else if(process.platform == 'win32') {
  options.platforms = ['win32'];
  options.winIco = './packaging/icon.ico';

  build(options, function(err){
    if(err) throw err;
    if(buildPackage) {
      // copy binaries
      fs.copySync('./build/passphrases/win32', './dist/Passphrases');

      // copy license
      fs.copySync('./LICENSE.md', './dist/Passphrases/LICENSE.md');

      // codesign Passphrases.exe
      child_process.execSync('signtool.exe sign /v /d "Passphrases" /a /tr "http://www.startssl.com/timestamp" .\\dist\\Passphrases\\Passphrases.exe');

      // make the installer
      child_process.execSync('makensisw packaging\\windows_installer.nsi');

      // codesign the installer
      child_process.execSync('signtool.exe sign /v /d "Passphrases" /a /tr "http://www.startssl.com/timestamp" .\\dist\\Passphrases_Setup.exe');
    }
  });
}

// unsupported platform
else {
  console.log('Error: unrecognized platform');
  process.exit();
}
