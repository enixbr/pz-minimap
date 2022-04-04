// ==UserScript==
// @name         Nordic Union Template/meatie
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  R-Place template script
// @author       oralekin, LittleEndu, ekgame
// @match        https://hot-potato.reddit.com/embed*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @updateURL    https://raw.githubusercontent.com/meatie-se/pixel-minimap/master/nordicUnionTemplateMeatie.user.js
// @downloadURL  https://raw.githubusercontent.com/meatie-se/pixel-minimap/master/nordicUnionTemplateMeatie.user.js
// @grant        none
// ==/UserScript==
// https://gist.githubusercontent.com/Fjedjik/d2c4616ad6f42a2aaa0f198cfa4aedb6/raw/85e65e522e467d057626337fe4491d096fa213e8/nordicunion.user.js
if (window.top !== window.self) {
    window.addEventListener('load', () => {
        // Load the image
        const image = document.createElement("img");
        image.src = "https://raw.githubusercontent.com/meatie-se/pixel-minimap/master/NordicTemplate.png";
        image.onload = () => {
            image.style = `position: absolute; left: 0; top: 0; width: ${image.width/3}px; height: ${image.height/3}px; image-rendering: pixelated; z-index: 1`;
        };

        // Add the image as overlay
        const camera = document.querySelector("mona-lisa-embed").shadowRoot.querySelector("mona-lisa-camera");
        const canvas = camera.querySelector("mona-lisa-canvas");
        canvas.shadowRoot.querySelector('.container').appendChild(image);

        // Add a style to put a hole in the pixel preview (to see the current or desired color)
        const waitForPreview = setInterval(() => {
            const preview = camera.querySelector("mona-lisa-pixel-preview");
            if (preview) {
              clearInterval(waitForPreview);
              const style = document.createElement('style')
              style.innerHTML = '.pixel { clip-path: polygon(-20% -20%, -20% 120%, 37% 120%, 37% 37%, 62% 37%, 62% 62%, 37% 62%, 37% 120%, 120% 120%, 120% -20%); }'
              preview.shadowRoot.appendChild(style);
            }
        }, 200);
    }, false);
}