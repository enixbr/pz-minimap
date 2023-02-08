// ==UserScript==
// @name         Pixelzone Minimap
// @namespace    http://tampermonkey.net/
// @version      2.0.1
// @description  Overlay-like tool for pixelzone.io
// @author       meatie, modified by enix
// @match        https://pixelzone.io/*
// @homepage     https://github.com/enixbr/pz-minimap
// @downloadURL  https://raw.githubusercontent.com/enixbr/pz-minimap/master/minimap.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

/* Based on https://github.com/Pinkfloydd/ArgentinaMap_PixelZone

Instructions

Use Tampermonkey plugin to inject this into the game. Add a script, paste in the code.

Images and the template list (templates.json, or templates/data.json) need to be on a https: server.
Github is possibly the easiest option, if you get the Github windows client for updating it.
Use Commit from your local folder, followed by "Push origin".

baseTemplateUrl is read from a cookie, and prompted for if missing. You don't need to edit this
script to change it. You can also change it in console:
setCookie("baseTemplateUrl", "https://path-here/")

https://pixelzone.io/2023/ is not supported.

Keys:
space : Show and hide the minimap. This also reloads your template images after update.
QERTYUIOP and FGHJKLZ : select color
+/- numpad: zoom minimap

Minimap starts hidden. The script is intended to load in light mode for multiple tabs.

Useful console commands:
listTemplates()
setCookie("baseTemplateUrl", "template-path-here")
setCookie("baseTemplateUrl", "")  - now it will prompt for path on reload

<Euzu>: as far as I know, it's not a bot, so you can use it
*/

// Default location of template images and templates.json. Is user input and stored in a cookie.

var baseTemplateUrl = 'https://raw.githubusercontent.com/enixbr/pz-minimap/master/'; //only as default
var vers = "Pixelzone Minimap";
var range = 6; //margin for showing the map window

var x, y, zoomlevel, zooming_out, zooming_in, zoom_time, x_window, y_window, coorDOM, gameWindow;
var toggle_show, toggle_follow, counter, image_list, needed_templates, mousemoved;
var minimap, minimap_board, minimap_cursor, minimap_box, minimap_text;
var ctx_minimap, ctx_minimap_board, ctx_minimap_cursor;

Number.prototype.between = function (a, b) {
  var min = Math.min.apply(Math, [a, b]);
  var max = Math.max.apply(Math, [a, b]);
  return this > min && this < max;
};

function startup() {

  window.timerDiv = undefined;

  var i, t = getCookie("baseTemplateUrl");

  var leftContainer, usersDiv, coordDiv;

  if (!t) {
    var msg = "URL location of template images and templates.json.";

    t = prompt(msg + "\nhttps: is required. Stores in a cookie.", baseTemplateUrl);

    if (t) setCookie("baseTemplateUrl", t);
    else t = "";
  }

  baseTemplateUrl = t;

  console.log(vers + ". TemplateUrl", baseTemplateUrl);

  console.log("Try: listTemplates() and keys space, QERTYUIOP FGHJKLZ");

  gameWindow = document.getElementsByTagName("canvas")[0];

  leftContainer = document.getElementsByClassName("_left_16o3w_27")[0];

  usersDiv = leftContainer.childNodes[0];
  coordDiv = leftContainer.childNodes[1];

  var pixelCounter = document.createElement('div');
  pixelCounter.className = '_flex_16o3w_1 _row_16o3w_8 _center_16o3w_14 _background_xd2n8_16 _padding_xd2n8_39 _margin_xd2n8_43 _fit-content_xd2n8_34 _note_9gyhg_1';
  pixelCounter.innerHTML = `<svg fill="none" stroke-width="2" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" height="1em" width="1em" style="width: 1.65em; height: 1.65em; overflow: visible; color: currentcolor; margin: 0; margin-block: 0; margin-left: 5px; margin-bottom: 5px;"><path xmlns="http://www.w3.org/2000/svg" d="M6.56 25.48c-0.32 0-0.64-0.2-0.76-0.52l-1.8-4.28-2.84 1.12c-0.24 0.12-0.56 0.080-0.8-0.080s-0.36-0.4-0.36-0.68v-13.68c0-0.32 0.2-0.64 0.52-0.76s0.68-0.040 0.92 0.2l9.68 9.68c0.2 0.2 0.28 0.48 0.24 0.76s-0.24 0.52-0.48 0.6l-2.8 1.2 1.76 4.28c0.16 0.44-0.040 0.92-0.44 1.080l-2.48 1.040c-0.16 0.040-0.24 0.040-0.36 0.040zM4.48 18.76c0.32 0 0.64 0.2 0.76 0.52l1.76 4.28 0.92-0.4-1.76-4.28c-0.16-0.44 0.040-0.92 0.44-1.080l2.44-1.040-7.36-7.36v10.44l2.48-1c0.080-0.040 0.2-0.080 0.32-0.080z"/></svg>
  <span id="pixelCounter" class="notranslate">0</span>`;
  leftContainer.appendChild(pixelCounter);

  //DOM element of the displayed X, Y
  coorDOM = coordDiv.childNodes[1];

  //coordinates of the middle of the window
  x_window = y_window = 0;

  //coordinates of cursor
  x = y = 0;

  //list of all available templates
  window.template_list = null;

  //minimap zoom level
  zoomlevel = 14;

  //toggle options
  toggle_show = false;
  toggle_follow = true; //if minimap is following window, x_window = x and y_window = y;
  zooming_in = zooming_out = false;
  zoom_time = 100;

  //array with all loaded template-images
  window.image_list = [];
  counter = 0;

  //templates which are needed in the current area
  needed_templates = [];

  //Cachebreaker to force image refresh. Set it to eg. 1
  window.cachebreaker = "";

  var div = document.createElement('div');
  div.setAttribute('class', 'post block bc2');

  div.innerHTML = `
  <style>
    #not_Used{display: none !important}

    .switch {
      position: relative;
      display: inline-block;
      width: 45px;
      height: 20px;
    }
    
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      -webkit-transition: .4s;
      transition: .4s;
    }
    
    .slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 0px;
      background-color: white;
      -webkit-transition: .4s;
      transition: .4s;
    }
    
    input:checked + .slider {
      background-color: #2196F3;
    }
    
    input:focus + .slider {
      box-shadow: 0 0 1px #2196F3;
    }
    
    input:checked + .slider:before {
      -webkit-transform: translateX(26px);
      -ms-transform: translateX(26px);
      transform: translateX(26px);
    }
    
    .slider.round {
      border-radius: 32px;
    }
    
    .slider.round:before {
      border-radius: 50%;
    }
  </style>

    <div id="minimapbg" style="background-color:rgba(0,0,0,0.5); border-radius:12px; position:absolute; right:6px; bottom:6px; z-index:1;">
      <div class="posy unselectable" id="posyt" style="background-size:100%; color:#fff; text-align:center; line-height:32px; vertical-align:middle; width:auto; height:auto; padding:6px 8px;">
        <div id="minimap-text" style="background:black;padding-left:5px;padding-right:5px;border-radius:8px;user-select:none;"></div>
        <div id="minimap-title" style="line-height:15px;font-size:1.2em;user-select:none;padding:8px;">${vers}</div>
        <div id="minimap-box" style="position: relative;width:390px;height:280px">
        <canvas id="minimap" style="width: 100%; height: 100%;z-index:1;position:absolute;top:0;left:0;"></canvas>
        <canvas id="minimap-board" style="width: 100%; height: 100%;z-index:2;position:absolute;top:0;left:0;"></canvas>
        <canvas id="minimap-cursor" style="width: 100%; height: 100%;z-index:3;position:absolute;top:0;left:0;"></canvas>
        </div><div id="minimap-config" style="line-height:15px;"><br>
        <span id="hide-map" style="cursor:pointer;user-select:none;background:black;padding-left:5px;padding-right:5px;border-radius:8px;margin-right:8px;">Hide
        </span> <span id="settings-map" style="cursor:pointer;user-select:none;background:black;padding-left:5px;padding-right:5px;border-radius:8px;margin-right:32px;">Settings
        </span> <span style='user-select: none;'>Zoom:</span> <span id="zoom-plus" style="cursor:pointer;font-weight:bold;user-select:none;background:black;padding-left:5px;padding-right:5px;border-radius:8px;">&nbsp;+&nbsp;</span>
        <span id="zoom-minus" style="cursor:pointer;font-weight:bold;user-select:none;background:black;padding-left:5px;padding-right:5px;border-radius:8px;">&nbsp;-&nbsp;</span>
      </div>
      </div>

      <div id="minimap_settings" style="background-size:100%; width:250px; height:auto; text-align:center; display:none;">
        <div id="minimap-title" style="line-height:15px;font-size:1.2em;user-select:none;padding:8px;">Settings</div>
        <br>
        <span style='user-select: none; padding-right: 16px;'>Auto-Color</span>
        <label class="switch">
          <input id='autoColor' type="checkbox">
          <span class="slider round"></span>
        </label>
        <br><br>
        <span style='user-select: none; padding-right: 16px;'>Faction</span>
        <select style='outline:0;font-family:Nunito,sans-serif;border-radius:32px;'><option>testesteste</option></select>
        <br><br>
        <span id="settings-map-2" style="cursor:pointer;user-select:none;text-align:center;background:black;padding-left:5px;padding-right:5px;border-radius:8px;">Go back</span><br><br>
      </div>
    </div>
    `;
  document.body.appendChild(div);

  minimap = document.getElementById("minimap");
  minimap_board = document.getElementById("minimap-board");
  minimap_cursor = document.getElementById("minimap-cursor");
  minimap.width = minimap.offsetWidth;
  minimap_board.width = minimap_board.offsetWidth;
  minimap_cursor.width = minimap_cursor.offsetWidth;
  minimap.height = minimap.offsetHeight;
  minimap_board.height = minimap_board.offsetHeight;
  minimap_cursor.height = minimap_cursor.offsetHeight;
  ctx_minimap = minimap.getContext("2d");
  ctx_minimap_board = minimap_board.getContext("2d");
  ctx_minimap_cursor = minimap_cursor.getContext("2d");
  minimap_box = document.getElementById("minimap-box");
  minimap_text = document.getElementById("minimap-text");

  //No Antialiasing when scaling!
  ctx_minimap.mozImageSmoothingEnabled = false;
  ctx_minimap.webkitImageSmoothingEnabled = false;
  ctx_minimap.msImageSmoothingEnabled = false;
  ctx_minimap.imageSmoothingEnabled = false;

  //Bugfix really
  document.getElementsByClassName("_pointer-children_xd2n8_73")[0].style = "max-height:1px";

  toggleShow(toggle_show);

  drawBoard();
  drawCursor();

  document.getElementsByClassName("_ratio_1owdq_1")[0].parentElement.style = "position:absolute;left:158px;zoom:0.66";

  var pal = document.getElementsByClassName("_ratio_1owdq_1")[0].firstChild.firstChild;

  // Loop the color divs, add tooltips
  for (i = 0; i < 16; i++) {
    pal.childNodes[i].firstChild.title = "QERTYUIOPFGHJKLZ".substr(i, 1) + ":" + i;
  }

  document.getElementById("hide-map").onclick = function () {
    toggleShow(false);
  };

  minimap_text.onclick = function () {
    toggleShow(true);
  };

  document.getElementById("settings-map").onclick = function () {
    document.getElementById("minimap_settings").style.display = 'block';
    document.getElementById("posyt").style.display = 'none';
  };

  document.getElementById("settings-map-2").onclick = function () {
    document.getElementById("minimap_settings").style.display = 'none';
    document.getElementById("posyt").style.display = 'block';
  };

  document.getElementById("zoom-plus").addEventListener('mousedown', function (e) {
    e.preventDefault();
    zooming_in = true;
    zooming_out = false;
    zoomIn();
  }, false);

  document.getElementById("zoom-minus").addEventListener('mousedown', function (e) {
    e.preventDefault();
    zooming_out = true;
    zooming_in = false;
    zoomOut();
  }, false);

  document.getElementById("zoom-plus").addEventListener('mouseup', function (e) {
    zooming_in = false;
  }, false);

  document.getElementById("zoom-minus").addEventListener('mouseup', function (e) {
    zooming_out = false;
  }, false);

  gameWindow.addEventListener('mouseup', function (evt) {
    if (!toggle_show) return;
    if (!toggle_follow) setTimeout(getCenter, 1650);
  }, false);

  gameWindow.addEventListener('mousemove', mymousemove, false);

  setInterval(updateloop, 5e3);

  updateloop();

  setInterval(function () {
    if (mousemoved) {
      mousemoved = false;
      loadTemplates();
    }
  }, 20);

  setInterval(() => {
    try {
      fetch('https://pixelzone.io/users/profile/me').then(body => body.json().then(data => {
        document.getElementById('pixelCounter').innerText = data.pixels;
      }))

    } catch (err) { };
  }, 5000)
}

window.addEventListener('load', function () {
  var loadInt = setInterval(() => {
    window.timerDiv = document.getElementsByClassName("_center_16o3w_14 _top_16o3w_18 _fit-content_xd2n8_34")[0].attributes;

    if (window.timerDiv.length > 0) {
      clearInterval(loadInt)

      startup();
    }
  }, 100)
}, false);

function mymousemove(evt) {
  if (!toggle_show || !coorDOM) return;

  var coordsXY = coorDOM.innerHTML.split(/\s?[xy:]+/);

  var x_new = parseInt(coordsXY[1]);
  var y_new = parseInt(coordsXY[2]);

  if (x != x_new || y != y_new) {
    x = x_new;
    y = y_new;

    if (toggle_follow) {
      x_window = x;
      y_window = y;
    } else {
      drawCursor();
    }
    mousemoved = 1;
  }

  if (document.getElementById('autoColor').checked == false) return;

  var hoveringColor = window.board.getImageData(195, 140, 1, 1).data + '';

  if (hoveringColor[3] === 0) return;

  switch (hoveringColor) {
    case '38,38,38,255': clickColor(0); break;

    case '0,0,0,255': clickColor(1); break;

    case '128,128,128,255': clickColor(2); break;

    case '255,255,255,255': clickColor(3); break;

    case '153,98,61,255': clickColor(4); break;

    case '255,163,200,255': clickColor(5); break;

    case '207,115,230,255': clickColor(6); break;

    case '128,0,128,255': clickColor(7); break;

    case '229,0,0,255': clickColor(8); break;

    case '229,137,0,255': clickColor(9); break;

    case '229,229,0,255': clickColor(10); break;

    case '150,230,70,255': clickColor(11); break;

    case '0,190,0,255': clickColor(12); break;

    case '0,230,230,255': clickColor(13); break;

    case '0,136,204,255': clickColor(14); break;

    case '0,0,230,255': clickColor(15); break;
  }
}

window.listTemplates = function () {
  var ttlpx = 0;
  var mdstr = "";
  
  if (!template_list) {
    console.log("### No templates. Show the minimap first");
    return;
  }

  Object.keys(template_list).map(function (index, ele) {
    var eles = template_list[index];

    if (!eles.name) return;

    var z = eles.width > 300 ? 2 : eles.width > 100 ? 4 : 8;

    var n = eles.name + "";

    if (n.indexOf("//") < 0) n = baseTemplateUrl + n;

    mdstr += '\n#### ' + index + ' ' + eles.width + 'x' + eles.height + ' ' + n;
    mdstr += ' https://pixelzone.io/?p=' + Math.floor(eles.x + eles.width / 2) + ',' + Math.floor(eles.y + eles.height / 2) + ',' + z + '\n';

    if (!isNaN(eles.width) && !isNaN(eles.height)) ttlpx += eles.width * eles.height;
  });

  mdstr = '### Total pixel count: ' + ttlpx + '\n' + mdstr;
}

function updateloop() {
  if (!toggle_show) return;

  var xmlhttp = new XMLHttpRequest();

  var url = baseTemplateUrl + "templates.json?" + new Date().getTime();

  xmlhttp.onreadystatechange = function () {
    if (this.readyState == 4) {
      if (this.status == 200) {
        window.template_list = JSON.parse(this.responseText);

        if (!toggle_follow) getCenter();
      }

      if (this.status == 0 || this.status > 399) setCookie("baseTemplateUrl", "");
    }
  };

  xmlhttp.open("GET", url, true);
  xmlhttp.timeout = 800;
  xmlhttp.send();

  image_list = [];
  loadTemplates();
}

function toggleShow(newValue) {
  if (newValue === undefined) toggle_show = !toggle_show;
  else toggle_show = newValue;
  if (!minimap_box) return;
  if (toggle_show) {
    minimap_box.style.display = "block";
    minimap_text.style.display = "none";
    document.getElementById("minimap-config").style.display = "block";
    loadTemplates();
  } else {
    minimap_box.style.display = "none";
    minimap_text.innerHTML = "Show Minimap";
    minimap_text.style.display = "block";
    minimap_text.style.cursor = "pointer";
    document.getElementById("minimap-config").style.display = "none";
  }
  var g = document.getElementsByClassName("grecaptcha-badge");
  if (g[0]) g[0].style.display = "none";
}

function zoomIn() {
  if (!zooming_in) return;
  zoomlevel = zoomlevel * 1.2;
  if (zoomlevel > 45) {
    zoomlevel = 45;
    return;
  }
  drawBoard();
  drawCursor();
  loadTemplates();
  setTimeout(zoomIn, zoom_time);
}

function zoomOut() {
  if (!zooming_out) return;
  zoomlevel = zoomlevel / 1.2;
  if (zoomlevel < 1) {
    zoomlevel = 1;
    return;
  }
  drawBoard();
  drawCursor();
  loadTemplates();
  setTimeout(zoomOut, zoom_time);
}

function loadTemplates() {
  if (!toggle_show) return;

  if (window.template_list == null || !minimap_box) return;

  var keys = Object.keys(template_list);

  needed_templates = [];

  keys.forEach(item => {
    if (!template_list[item].width) return;

    var temp_x = template_list[item].x;
    var temp_y = template_list[item].y;
    var temp_xr = temp_x + template_list[item].width;
    var temp_yb = temp_y + template_list[item].height;

    if (!x_window.between(temp_x - range, temp_xr + range)) return;
    if (!y_window.between(temp_y - range, temp_yb + range)) return;

    needed_templates.push(item);
  })
/*
  for (var i = 0; i < keys.length; i++) {
    var template = keys[i];

    if (!template_list[template].width) continue;

    var temp_x = template_list[template].x;
    var temp_y = template_list[template].y;
    var temp_xr = temp_x + template_list[template].width;
    var temp_yb = temp_y + template_list[template].height;

    if (!x_window.between(temp_x - range, temp_xr + range)) continue;
    if (!y_window.between(temp_y - range, temp_yb + range)) continue;

    needed_templates.push(template);
  }*/
  if (needed_templates.length == 0) {
    if (zooming_in == false && zooming_out == false) {
      minimap_box.style.display = "none";
      minimap_text.style.display = "block";
      minimap_text.innerHTML = "No templates here";
      minimap_text.style.cursor = "auto";
    }
  } else {
    minimap_box.style.display = "block";
    minimap_text.style.display = "none";
    counter = 0;
    for (i = 0; i < needed_templates.length; i++) {
      if (image_list[needed_templates[i]] == null) {
        loadImage(needed_templates[i]);
      } else {
        counter += 1;
        //if last needed image loaded, start drawing
        if (counter == needed_templates.length) drawTemplates();
      }
    }
  }
}

function loadImage(imagename) {
  console.log("    Load image " + imagename, cachebreaker);

  image_list[imagename] = new Image();

  var src = template_list[imagename].name;

  if (src.indexOf("//") < 0) src = baseTemplateUrl + src;
  if (cachebreaker) src += "?" + cachebreaker;

  image_list[imagename].crossOrigin = "Anonymous";
  image_list[imagename].src = src;

  image_list[imagename].onload = function () {
    counter += 1;

    if (counter == needed_templates.length) drawTemplates(); //if last needed image loaded, start drawing
  }
}

function drawTemplates() {
  ctx_minimap.clearRect(0, 0, minimap.width, minimap.height);
  var x_left = x_window * 1 - minimap.width / zoomlevel / 2;
  var y_top = y_window * 1 - minimap.height / zoomlevel / 2;
  for (var i = 0; i < needed_templates.length; i++) {
    var template = needed_templates[i];
    var xoff = (template_list[template].x * 1 - x_left * 1) * zoomlevel;
    var yoff = (template_list[template].y * 1 - y_top * 1) * zoomlevel;
    var newwidth = zoomlevel * image_list[template].width;
    var newheight = zoomlevel * image_list[template].height;
    ctx_minimap.drawImage(image_list[template], xoff, yoff, newwidth, newheight);
    //console.log("Drawn!");
  }
}

function drawBoard() {
  ctx_minimap_board.clearRect(0, 0, minimap_board.width, minimap_board.height);
  if (zoomlevel <= 4.6) return;
  ctx_minimap_board.beginPath();
  var bw = minimap_board.width + zoomlevel;
  var bh = minimap_board.height + zoomlevel;
  var xoff_m = (minimap.width / 2) % zoomlevel - zoomlevel;
  var yoff_m = (minimap.height / 2) % zoomlevel - zoomlevel;
  var z = 1 * zoomlevel;
  ctx_minimap_board.lineWidth = 0.2;
  for (var x = 0; x <= bw; x += z) {
    ctx_minimap_board.moveTo(x + xoff_m, yoff_m);
    ctx_minimap_board.lineTo(x + xoff_m, bh + yoff_m);
  }
  for (x = 0; x <= bh; x += z) {
    ctx_minimap_board.moveTo(xoff_m, x + yoff_m);
    ctx_minimap_board.lineTo(bw + xoff_m, x + yoff_m);
  }
  ctx_minimap_board.strokeStyle = "black";
  ctx_minimap_board.stroke();
}

function drawCursor() {
  var x_left = x_window * 1 - minimap.width / zoomlevel / 2;
  var x_right = x_window * 1 + minimap.width / zoomlevel / 2;
  var y_top = y_window * 1 - minimap.height / zoomlevel / 2;
  var y_bottom = y_window * 1 + minimap.height / zoomlevel / 2;

  ctx_minimap_cursor.clearRect(0, 0, minimap_cursor.width, minimap_cursor.height);

  if (x < x_left || x > x_right || y < y_top || y > y_bottom) return;

  var xoff_c = x - x_left;
  var yoff_c = y - y_top;

  ctx_minimap_cursor.beginPath();
  ctx_minimap_cursor.lineWidth = zoomlevel / 6;
  ctx_minimap_cursor.strokeStyle = "#ff1bfc";
  ctx_minimap_cursor.rect(zoomlevel * xoff_c, zoomlevel * yoff_c, zoomlevel, zoomlevel);
  ctx_minimap_cursor.stroke();

  window.board = ctx_minimap;
}

function getCenter() {
  var s = window.location.search.split(",");
  var cx = parseInt(s[0].split("=")[1]), cy = parseInt(s[1]);

  x_window = cx;
  y_window = cy;

  loadTemplates();
}

window.addEventListener('keydown', function (e) {
  switch (e.keyCode) {
    case 32: //space
      toggleShow();

      if (toggle_show) {
        window.cachebreaker++;
        console.log("cachebreaker = ", cachebreaker);
        updateloop();
      }

      mymousemove();
    break;

    case 81: clickColor(0); break;
    case 69: clickColor(1); break;
    case 82: clickColor(2); break;
    case 84: clickColor(3); break;
    case 89: clickColor(4); break;
    case 85: clickColor(5); break;
    case 73: clickColor(6); break;
    case 79: clickColor(7); break;
    case 80: clickColor(8); break;
    case 70: clickColor(9); break;
    case 71: clickColor(10); break;
    case 72: clickColor(11); break;
    case 74: clickColor(12); break;
    case 75: clickColor(13); break;
    case 76: clickColor(14); break;
    case 192:
    case 90: clickColor(15); break;
    case 87: //WASD
    case 65:
    case 83:
    case 68:
      break;
    case 107: //numpad +
      zooming_in = true;
      zooming_out = false;
      zoomIn();
      zooming_in = false;
      break;
    case 109: //numpad -
      zooming_out = true;
      zooming_in = false;
      zoomOut();
      zooming_out = false;
      break;
    case 88: //x: hide more elements
      /*var UIDiv = document.getElementById("upperCanvas").nextElementSibling;
      var menu = UIDiv.childNodes[4];
      var playercount = UIDiv.childNodes[3].childNodes[0];
      var coords = playercount.nextElementSibling;
      if(menu.style.display != "none") {
        menu.style.display = "none";
      } else if(playercount.style.display != "none"){ //hide counter
        playercount.style.display = "none";
      } else {
        coords.style.display = "none";
      }*/
      break;
    default:
      console.log("keydown", e.keyCode, e.key);
  }
});

function clickColor(c) {
  var pal = document.getElementsByClassName("_ratio_1owdq_1")[0].firstChild.firstChild;
  //https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent
  var e = new MouseEvent("click", {
    clientX: 5, clientY: 5,
    bubbles: true
  });
  pal.childNodes[c].firstChild.dispatchEvent(e);
}

function setCookie(name, value) { //you can supply "minutes" as 3rd arg.
  var argv = setCookie.arguments;
  var argc = setCookie.arguments.length;
  var minutes = (argc > 2) ? argv[2] : 720 * 1440; //default 720 days
  var date = new Date();
  date.setTime(date.getTime() + (minutes * 60 * 1000));
  var expires = "";
  if (minutes > 0) expires = "; Expires=" + date.toGMTString();
  document.cookie = name + "=" + value + expires + "; SameSite=Lax; Path=/";
}
window.setCookie = setCookie;

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}