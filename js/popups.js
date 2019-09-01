// popups.js: standaline Javascript library for creating 'popups' which display link metadata (typically, title/author/date/summary), for extremely convenient reference/abstract reading.
// Author: Said Achmiz, Shawn Presser (mobile & Youtube support)
// 2019
// license: MIT (derivative of footnotes.js, which is PD)

// Function: Whenever any such link is mouse-overed by the user, popups.js will pop up a large tooltip-like square with the contents of the attributes. This is particularly intended for references, where it is extremely convenient to autopopulate links such as to Arxiv.org/Biorxiv.org/Wikipedia with the link's title/author/date/abstract, so the reader can see it instantly. The popup is carefully placed to let it fade out easily and not obstruct the mouse, so users can do things like move a mouse down a list of links and see each preview fade in & fade out.
//
// On mobile, clicking on links (as opposed to hovering over links on desktop) will bring up the annotation or preview; another click on it or the popup will then go to it. A click outside it de-activates it.

// Advantages: Popups save the user both time and bandwidth as they can instantly see a summary or at least preview of the first screen, and decide whether to pursue it further; if they had to click on it, that is both heavy-weight interaction, uses possibly several seconds to load & render, and will use many times the bandwidth (a popup is a few kb at most, a preview screenshot averages ~40kb or 0.04MB, and a full webpge or PDF averages >3MB or 75x more and increasing over time, so if a popup saves the user a click even once in a while, it reduces their total bandwidth use). For a website like gwern.net with ~30k external links (many handled by auto-generated or custom annotations), the necessary previews weigh <1GB.

// Technical details: popups.js parses a HTML document and looks for <a> links which have the 'docMetadata' attribute class, and the attributes 'data-popup-title', 'data-popup-author', 'data-popup-date', 'data-popup-doi', 'data-popup-abstract'.
// (These attributes are expected to be populated already by the HTML document's compiler, however, they can also be done dynamically. See 'wikipedia-popups.js' for an example of a library which does Wikipedia-only dynamically on page loads.)
// In the case of no attributes, the popups will instead look for a preview PNG it can display, at /static/previews/$SHA1($URL).png (such as generated by Ghostscript or a headless Chrome browser); for more details, see https://www.gwern.net/linkScreenshot.sh + https://www.gwern.net/LinkMetadata.hs. $URL includes the hash/anchor, so links like 'foo.com/paper.pdf#page=11' display a screenshot of the specified page 11.
//
// For an example of a Hakyll library which generates annotations for Wikipedia/Biorxiv/Arxiv/PDFs/arbitrarily-defined links, see https://www.gwern.net/LinkMetadata.hs ; for a live demonstration, see the links in https://www.gwern.net/newsletter/2019/08

// uncomment for pasteability into a console & live debugging:
// if (Extracts && Extracts.popupBreathingRoomFactor)
//     Extracts.unbind();

Extracts = {
    popupStylesID: "popups-styles",
    popupContainerID: "popup-container",
    popupContainerParentSelector: "#markdownBody",
    targetElementsSelector: "#markdownBody a[href^='http'], #markdownBody a[href^='./']",
    minPopupWidth: 360,
    maxPopupWidth: 640,
    screenshotSize: 768,
    videoPopupWidth: 495,
    videoPopupHeight: 310,
    popupTriggerDelay: 150,
    popupFadeoutDelay: 50,
    popupFadeoutDuration: 250,
    popupFadeTimer: false,
    popupDespawnTimer: false,
    popupSpawnTimer: false,
    popupBreathingRoomX: 24.0,
    popupBreathingRoomY: 16.0,
    popup: null,
    encoder: new TextEncoder(),
    previewsPath: "/static/previews/",
    previewsFileExtension: "png",
    isMobileMediaQuery: matchMedia("not screen and (hover:hover) and (pointer:fine)"),
    extractForTarget: function(target) {
        return `<div class='popup-extract' onclick='parentNode.remove()'>` +
                    `<p class='data-field title'><a class='icon' target='_new' href='${target.href}' title='Open this reference in a new window'></a><a class='title-link' target='_new' href='${target.href}' title='${target.href}'>${target.dataset.popupTitle || ""}</a></p>` +
                    `<p class='data-field author-plus-date'>${target.dataset.popupAuthor || ""}${target.dataset.popupDate ? (" (" + target.dataset.popupDate + ")") : ""}</p>` +
                    `<div class='data-field abstract' onclick='parentNode.remove()'>${target.dataset.popupAbstract || ""}</div>` +
                `</div>`;
    },
    youtubeId: function youtubeId(url) {
        let match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        if (match && match[2].length == 11) {
            return match[2];
        } else {
            return '';
        }
    },
    videoForTarget: function(target, videoId) {
        return `<div class='popup-screenshot' onclick="parentNode.remove()">` +
            `<iframe width="${Extracts.videoPopupWidth}px" height="${Extracts.videoPopupHeight}px"` +
            `src="//www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen>` +
            `</iframe></div>`;
    },
    previewForTarget: function(target) {
        /*  The SHA-1 hashes are generated of local paths like 'docs/statistics/decision/2006-drescher-goodandreal.pdf',
            not 'https://www.gwern.net/docs/statistics/decision/2006-drescher-goodandreal.pdf',
            so we can't just use `target.href` for those.
            If it's a remote URL, then it's fine.
            */
        const canonicalHref = target.href.startsWith("https://www.gwern.net/") ? target.pathname.substr(1)+target.hash : target.href;
        const hashPromise = crypto.subtle.digest('SHA-1', Extracts.encoder.encode(canonicalHref));
        hashPromise.then(async (linkURLArrayBuffer) => {
            const linkURLHash = Array.from(new Uint8Array(linkURLArrayBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            Extracts.popup.innerHTML = `<div class='popup-screenshot'>` +
                `<a alt='Screenshot of page at ${target.href}' title='${target.href}' target='_new' href='${target.href}'>` +
                `<img src='${Extracts.previewsPath}${linkURLHash}.${Extracts.previewsFileExtension}'>` +
                `</a></div>`;
        });
        return "";
    },
    unbind: function() {
        document.querySelectorAll(Extracts.targetElementsSelector).forEach(target => {
            //  Unbind existing mouseover/mouseout events, if any.
            target.removeEventListener("mouseover", Extracts.targetover);
            target.removeEventListener("mouseout", Extracts.targetout);
            target.onclick = () => {};
        });
        if (Extracts.popupContainer)
            Extracts.popupContainer.removeEventListener("mouseup", Extracts.popupContainerClicked);
    },
    cleanup: function() {
        console.log("popups.js: Cleaning up...");

        // Unbind event listeners.
        Extracts.unbind();

        // Remove popups container and injected styles.
        document.querySelectorAll(`#${Extracts.popupStylesID}, #${Extracts.popupContainerID}`).forEach(element => element.remove());
    },
    setup: function() {
        // Run cleanup.
        Extracts.cleanup();

        console.log("popups.js: Setting up...");

        // Inject styles.
        document.querySelector("head").insertAdjacentHTML("beforeend", Extracts.popupStylesHTML);

        // Inject popups container.
        var popupContainerParent = document.querySelector(Extracts.popupContainerParentSelector);
        document.querySelector(Extracts.popupContainerParentSelector).insertAdjacentHTML("beforeend", `<div id='${Extracts.popupContainerID}'></div>`);
        requestAnimationFrame(() => {
            Extracts.popupContainer = document.querySelector(`#${Extracts.popupContainerID}`);
            Extracts.popupContainer.addEventListener("mouseup", Extracts.popupContainerClicked);
        });

        //  Get all targets.
        document.querySelectorAll(Extracts.targetElementsSelector).forEach(target => {
            //  Bind mousemover/mouseout events.
            target.addEventListener("mouseover", Extracts.targetover);
            target.addEventListener("mouseout", Extracts.targetout);

            // Remove the title attribute.
            target.removeAttribute("title");
            target.onclick = () => { return false; };
        });
    },
    //  The mouseover event.
    targetover: (event) => {
        event.preventDefault();

        //  Stop the countdown to un-pop the popup.
        clearTimeout(Extracts.popupFadeTimer);
        clearTimeout(Extracts.popupDespawnTimer);
        clearTimeout(Extracts.popupSpawnTimer);

        document.querySelector("html").style.transform = "translateX(0)";

        Extracts.popupSpawnTimer = setTimeout(() => {
            //  Get the target.
            let target = event.target.closest("a");
            target.onclick = () => {};

            let popupContainerViewportRect = Extracts.popupContainer.getBoundingClientRect();
            let targetViewportRect = target.getBoundingClientRect();
            let targetOriginInPopupContainer = {
                x: (targetViewportRect.left - popupContainerViewportRect.left),
                y: (targetViewportRect.top - popupContainerViewportRect.top)
            }
            let mouseOverEventPositionInPopupContainer = {
                x: (event.clientX - popupContainerViewportRect.left),
                y: (event.clientY - popupContainerViewportRect.top)
            };

            //  Get, or create, the popup.
            Extracts.popup = document.querySelector("#popupdiv");
            if (Extracts.popup) {
                Extracts.popup.classList.remove("fading");
                Extracts.popup.remove();
            } else {
                Extracts.popup = document.createElement('div');
                Extracts.popup.id = "popupdiv";
                Extracts.popup.className = target.className;
            }

            var isScreenshot = false;
            var isVideo = false;
            let videoId = Extracts.youtubeId(target.href);

            //  Inject the contents of the popup into the popup div.
            if (target.classList.contains("docMetadata")) {
                Extracts.popup.innerHTML = Extracts.extractForTarget(target);
            } else if (videoId) {
                Extracts.popup.innerHTML = Extracts.videoForTarget(target, videoId);
                isVideo = true;
            } else {
                Extracts.popup.innerHTML = Extracts.previewForTarget(target);
                isScreenshot = true;
            }

            //  Inject the popup into the page.
            Extracts.popup.style.visibility = "hidden";
            Extracts.popup.style.left = "0px";
            Extracts.popup.style.top = "0px";
            document.querySelector(`#${Extracts.popupContainerID}`).appendChild(Extracts.popup);

            //  Add event listeners.
            Extracts.popup.addEventListener("mouseup", (event) => { event.stopPropagation(); });
            Extracts.popup.addEventListener("mouseover", Extracts.divover);
            Extracts.popup.addEventListener("mouseout", Extracts.targetout);

            requestAnimationFrame(() => {
                /*  How much “breathing room” to give the target (i.e., offset of
                    the popup).
                    */
                var popupBreathingRoom = {
                    x: Extracts.popupBreathingRoomX,
                    y: Extracts.popupBreathingRoomY
                };

                /*  This is the width and height of the popup, as already determined
                    by the layout system, and taking into account the popup’s content,
                    and the max-width, min-width, etc., CSS properties.
                    */
                var popupIntrinsicWidth = Extracts.popup.clientWidth;
                var popupIntrinsicHeight = Extracts.popup.clientHeight;

                var offToTheSide = false;

                var provisionalPopupXPosition;
                var provisionalPopupYPosition;

                /*  Can the popup fit above the target? If so, put it there.
                    Failing that, can it fit below the target? If so, put it there.
                    */
                var popupSpawnYOriginForSpawnAbove = Math.min(mouseOverEventPositionInPopupContainer.y - popupBreathingRoom.y,
                                                              targetOriginInPopupContainer.y + targetViewportRect.height - (popupBreathingRoom.y * 2.0));
                var popupSpawnYOriginForSpawnBelow = Math.max(mouseOverEventPositionInPopupContainer.y + popupBreathingRoom.y,
                                                              targetOriginInPopupContainer.y + (popupBreathingRoom.y * 2.0));
                if (  popupSpawnYOriginForSpawnAbove - popupIntrinsicHeight >= popupContainerViewportRect.y * -1) {
                    // Above.
                    provisionalPopupYPosition = popupSpawnYOriginForSpawnAbove - popupIntrinsicHeight;
                } else if (  popupSpawnYOriginForSpawnBelow + popupIntrinsicHeight <= (popupContainerViewportRect.y * -1) + window.innerHeight) {
                    // Below.
                    provisionalPopupYPosition = popupSpawnYOriginForSpawnBelow;
                } else {
                    /*  The popup does not fit above or below! We will have to
                        put it off to the left or right.
                        */
                    offToTheSide = true;
                }

                if (offToTheSide) {
                    // Determine popup X position.
                    popupBreathingRoom.x *= 2.0;
                    provisionalPopupYPosition = mouseOverEventPositionInPopupContainer.y - ((event.clientY / window.innerHeight) * popupIntrinsicHeight);

                    // Determine whether to put the popup off to the right, or left.
                    if (  mouseOverEventPositionInPopupContainer.x
                        + popupBreathingRoom.x
                        + popupIntrinsicWidth
                          <=
                          popupContainerViewportRect.x * -1
                        + window.innerWidth) {
                        // Off to the right.
                        provisionalPopupXPosition = mouseOverEventPositionInPopupContainer.x + popupBreathingRoom.x;
                    } else if (  mouseOverEventPositionInPopupContainer.x
                               - popupBreathingRoom.x
                               - popupIntrinsicWidth
                                 >=
                                 popupContainerViewportRect.x * -1) {
                        // Off to the left.
                        provisionalPopupXPosition = mouseOverEventPositionInPopupContainer.x - popupIntrinsicWidth - popupBreathingRoom.x;
                    }
                } else {
                    /*  Place popup off to the right (and either above or below),
                        as per the previous block of code.
                        */
                    provisionalPopupXPosition = mouseOverEventPositionInPopupContainer.x + popupBreathingRoom.x;
                }

                /*  Does the popup extend past the right edge of the container?
                    If so, move it left, until its right edge is flush with
                    the container’s right edge.
                    */
                if (provisionalPopupXPosition + popupIntrinsicWidth > popupContainerViewportRect.width) {
                    provisionalPopupXPosition -= provisionalPopupXPosition + popupIntrinsicWidth - popupContainerViewportRect.width;
                }

                /*  Now (after having nudged the popup left, if need be),
                    does the popup extend past the *left* edge of the container?
                    Make its left edge flush with the container’s left edge.
                    */
                if (provisionalPopupXPosition < 0) {
                    provisionalPopupXPosition = 0;
                }

                Extracts.popup.style.left = provisionalPopupXPosition + "px";
                Extracts.popup.style.top = provisionalPopupYPosition + "px";

                Extracts.popupContainer.classList.add("popup-visible");
                Extracts.popup.style.visibility = "";
                document.activeElement.blur();
            });
        }, Extracts.popupTriggerDelay);
    },
    //  The mouseout event.
    targetout: (event) => {
        clearTimeout(Extracts.popupFadeTimer);
        clearTimeout(Extracts.popupDespawnTimer);
        clearTimeout(Extracts.popupSpawnTimer);

        if (!Extracts.popup) return;

        Extracts.popupFadeTimer = setTimeout(() => {
            Extracts.popup.classList.add("fading");
            Extracts.popupDespawnTimer = setTimeout(() => {
                Extracts.despawnPopup();
            }, Extracts.popupFadeoutDuration);
        }, Extracts.popupFadeoutDelay);
    },
    //  The “user moved mouse back into popup” mouseover event.
    divover: (event) => {
        clearTimeout(Extracts.popupFadeTimer);
        clearTimeout(Extracts.popupDespawnTimer);
        clearTimeout(Extracts.popupSpawnTimer);
        Extracts.popup.classList.remove("fading");
    },
    popupContainerClicked: (event) => {
        Extracts.despawnPopup();
    },
    despawnPopup: () => {
        Extracts.popup.remove();
        document.activeElement.blur();
        Extracts.popup.classList.remove("fading");
        document.querySelector("html").style.transform = "";
        Extracts.popupContainer.classList.remove("popup-visible");
    }
}

Extracts.popupStylesHTML = `<style id='${Extracts.popupStylesID}'>
#${Extracts.popupContainerID} {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}
#${Extracts.popupContainerID} > * {
    pointer-events: auto;
}
@media not screen and (hover:hover) and (pointer:fine) {
    #${Extracts.popupContainerID}.popup-visible::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        pointer-events: auto;
        background-color: #000;
        opacity: 0.4;
    }
}

#popupdiv {
    z-index: 10001;
    font-size: 0.8em;
    box-shadow: 0 0 0 2px #fff;
    position: absolute;
    opacity: 1.0;
    transition: none;
    touch-action: none;
    user-select: none;
}
#popupdiv.fading {
    opacity: 0.0;
    transition:
        opacity 0.75s ease-in 0.1s;
}
#popupdiv > div {
    background-color: #fff;
    padding: 12px 16px 14px 16px;
    border: 3px double #aaa;
    line-height: 1.45;
    overflow: auto;
    overscroll-behavior: none;
    touch-action: none;
    user-select: none;
    max-width: ${Extracts.maxPopupWidth}px;
}
#popupdiv > div .data-field {
    text-align: left;
    text-indent: 0;
    hyphens: none;
}
#popupdiv > div .data-field + .data-field {
    margin-top: 0.25em;
}
#popupdiv > div .data-field:empty {
    display: none;
}
#popupdiv > div .data-field.title {
    font-weight: bold;
    font-size: 1.125em;
}
#popupdiv > div .data-field.author-plus-date {
    font-style: italic;
}
#popupdiv > div .data-field.abstract {
    text-align: justify;
    text-indent: 2em;
    hyphens: auto;
}
#popupdiv > div.popup-screenshot {
    padding: 0;
    max-width: unset;
}
#popupdiv > div.popup-screenshot img {
    display: block;
}
#popupdiv > div.popup-screenshot a::after {
    content: none;
}
#popupdiv > div .icon {
    background-image: none !important;
    position: relative;
    top: 0.15em;
    font-size: 1.125em;
}
#popupdiv > div .icon::after {
    margin: 0 0.175em 0 0;
    width: 1em;
    height: 1em;
    font-size: 1em;
}
#popupdiv > div .icon:not([href*='.pdf'])::after {
    background-position: center center;
    background-size: 100%;
}
#popupdiv > div .title-link::after {
    content: none;
}

/*  Scroll bar styles (Webkit/Blink only).
    */
#popupdiv > div::-webkit-scrollbar {
    width: 14px;
}
#popupdiv > div::-webkit-scrollbar-thumb {
    background-color: #ccc;
    box-shadow:
        0 0 0 3px #fff inset;
}
#popupdiv > div::-webkit-scrollbar-thumb:hover {
    background-color: #999;
}

/*  Popups on mobile.
    */
@media only screen and (max-width: 64.9ch), not screen and (hover:hover) and (pointer:fine) {
    #popupdiv > div {
        max-width: 100%;
    }
}

/*  Image focus interaction.
    */
#markdownBody #popupdiv img {
    filter: none;
    cursor: initial;
    transform: none;
}
#markdownBody #popupdiv .popup-screenshot a img {
    cursor: pointer;
}
</style>`;

if (document.readyState == "complete") {
    Extracts.setup();
} else {
    window.addEventListener("load", Extracts.setup);
}
