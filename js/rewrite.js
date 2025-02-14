/* Miscellaneous JS functions which run after the page loads to rewrite or adjust parts of the page. */
/* author: Said Achmiz */
/* license: MIT */

/*************/
/* CLIPBOARD */
/*************/

/*******************************************/
/*  Set up copy processors in main document.
 */
doWhenDOMContentLoaded(() => {
    registerCopyProcessorsForDocument(document);
});


/*************/
/* AUX-LINKS */
/*************/

/*************************************************************************/
/*  Add “backlinks” link to start of section popups, when that section has
    a backlinks block.
 */
addContentInjectHandler(GW.contentInjectHandlers.injectBacklinksLinkIntoLocalSectionPopFrame = (eventInfo) => {
    GWLog("injectBacklinksLinkIntoLocalSectionPopFrame", "rewrite.js", 1);

    let containingPopFrame = Extracts.popFrameProvider.containingPopFrame(eventInfo.container);
    if (   containingPopFrame.classList.contains("local-page") == true
        && containingPopFrame.classList.contains("full-page") == false) {
        let section = eventInfo.container.querySelector("section");
        if (section == null)
            return;

        let backlinksBlock = eventInfo.container.querySelector(`#${(CSS.escape(section.id))}-backlinks`);
        if (backlinksBlock == null)
            return;

        //  Construct link and enclosing block.
        let backlinksLink = newElement("A", {
            "class": "aux-links backlinks",
            "href": "#" + backlinksBlock.id
        }, {
            "innerHTML": "backlinks"
        });
        let sectionMetadataBlock = newElement("P", {
            "class": "section-metadata"
        });
        sectionMetadataBlock.append(backlinksLink);
        section.insertBefore(sectionMetadataBlock, section.children[1]);

        //  Make a click on the link uncollapse the backlinks block.
        backlinksLink.addActivateEvent((event) => {
            if (isWithinCollapsedBlock(backlinksBlock)) {
                GW.notificationCenter.addHandlerForEvent("Collapse.collapseStateDidChange", (info) => {
                    revealElement(backlinksBlock);
                }, {
                    once: true,
                    condition: (isWithinCollapsedBlock(backlinksBlock) == false)
                });
            } else {
                requestAnimationFrame(() => {
                    revealElement(backlinksBlock);
                });
            }
        });
    }
}, "rewrite", (info) => (info.context == "popFrame"));


/*********/
/* LISTS */
/*********/

GW.layout.orderedListTypes = [
	"decimal",
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman"
];

/*****************************************************************************/
/*	Returns the type (CSS `list-item` counter value type) of an <ol> element.
 */
function orderedListType(list) {
	if (list?.tagName != "OL")
		return null;

	for (let type of GW.layout.orderedListTypes)
		if (list.classList.contains(`list-type-${type}`))
			return type;

	return null;
}

/************************************************************************/
/*	Sets the type (CSS `list-item` counter value type) of an <ol> element.
 */
function setOrderedListType(list, type) {
	if (list?.tagName != "OL")
		return;

	for (let type of GW.layout.orderedListTypes)
		list.classList.remove(`list-type-${type}`);

	list.classList.add(`list-type-${type}`);
}

/*******************************************************************/
/*	Returns the nesting level (an integer in [1,listCyclePeriod]) of 
	a <ul> element.
 */
function unorderedListLevel(list) {
	if (list?.tagName != "UL")
		return 0;

	let prefix = "list-level-";

	return (parseInt(Array.from(list.classList).find(c => c.startsWith(prefix))?.slice(prefix.length)) || 1);
}

/***********************************************************/
/*	Sets CSS class matching nesting level of a <ul> element.
 */
function setUnorderedListLevel(list, level) {
	if (list?.tagName != "UL")
		return;

	let prefix = "list-level-";

	list.swapClasses([ Array.from(list.classList).find(c => c.startsWith(prefix)), `${prefix}${level}` ], 1);
}

/***********************************/
/*  Designate list type via a class.
 */
addContentInjectHandler(GW.contentInjectHandlers.designateListTypes = (eventInfo) => {
    GWLog("designateListTypes", "rewrite.js", 1);

    //	Workaround for case-insensitivity of CSS selectors.
    eventInfo.container.querySelectorAll("ol[type]").forEach(list => {
        switch (list.type) {
        case '1':
            setOrderedListType(list, "decimal");
            break;
        case 'a':
            setOrderedListType(list, "lower-alpha");
            break;
        case 'A':
            setOrderedListType(list, "upper-alpha");
            break;
        case 'i':
            setOrderedListType(list, "lower-roman");
            break;
        case 'I':
            setOrderedListType(list, "upper-roman");
            break;
        default:
            break;
        }
    });

	//	If not explicitly specified, cycle between these three list types.
    eventInfo.container.querySelectorAll("ol:not([type])").forEach(list => {
		let enclosingList = list.parentElement?.closest("ol");
		let enclosingListType = enclosingList?.parentElement?.matches("section#footnotes")
								? null
								: orderedListType(enclosingList);

    	switch (enclosingListType) {
		case "decimal":
			setOrderedListType(list, "upper-roman");
			break;
		case "upper-roman":
			setOrderedListType(list, "lower-alpha");
			break;
		case "lower-alpha":
		default:
			setOrderedListType(list, "decimal");
			break;
    	}
    });

	//	Set list levels.
	let listCyclePeriod = 3;
	eventInfo.container.querySelectorAll("ul").forEach(list => {
		setUnorderedListLevel(list, (unorderedListLevel(list.parentElement?.closest("ul")) % listCyclePeriod) + 1);
	});
}, ">rewrite");

/*****************************************************************/
/*	Wrap text nodes and inline elements in list items in <p> tags.
 */
addContentLoadHandler(GW.contentLoadHandlers.paragraphizeListTextNodes = (eventInfo) => {
    GWLog("paragraphizeListTextNodes", "rewrite.js", 1);

	eventInfo.container.querySelectorAll(selectorize([ "li" ])).forEach(paragraphizeTextNodesOfElement);
}, "rewrite");

/**********************************************/
/*  Rectify styling/structure of list headings.
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyListHeadings = (eventInfo) => {
    GWLog("rectifyListHeadings", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("p > strong:only-child").forEach(boldElement => {
        if (   boldElement.parentElement.childNodes.length == 2
            && boldElement.parentElement.firstChild == boldElement
            && boldElement.parentElement.lastChild.nodeType == Node.TEXT_NODE
            && boldElement.parentElement.lastChild.nodeValue == ":") {
            boldElement.parentElement.lastChild.remove();
            boldElement.lastTextNode.nodeValue += ":";
        }

        if (   boldElement.parentElement.childNodes.length == 1
            && boldElement.parentElement.tagName == "P"
            && boldElement.parentElement.nextElementSibling
            && boldElement.closest("LI") == null
            && (   [ "UL", "OL" ].includes(boldElement.parentElement.nextElementSibling.tagName)
                || boldElement.parentElement.nextElementSibling.classList.contains("columns")))
            boldElement.parentElement.classList.add("list-heading");
    });
}, "rewrite");


/***************/
/* BLOCKQUOTES */
/***************/

/****************************************/
/*	Rectify HTML structure of interviews.
 */
addContentLoadHandler(GW.contentLoadHandlers.rewriteInterviews = (eventInfo) => {
    GWLog("rewriteInterviews", "rewrite.js", 1);

	eventInfo.container.querySelectorAll("div.interview, div.interview > div.collapse").forEach(interviewWrapper => {
		if (interviewWrapper.firstElementChild.tagName != "UL")
			return;

		let interview = interviewWrapper.firstElementChild;
		interview.classList.add("interview");

		for (let exchange of interview.children) {
			exchange.classList.add("exchange");

			for (let utterance of exchange.firstElementChild.children) {
				utterance.classList.add("utterance");

				let speaker = utterance.querySelector("strong");

				//	If the speaker is wrapped, find the outermost wrapper.
				let nextNode;
				while (   speaker.parentElement
					   && speaker.parentElement.tagName != "P")
					speaker = speaker.parentElement;
				nextNode = speaker.nextSibling;
				speaker.classList.add("speaker");
				speaker.querySelector("speaker")?.classList.remove("speaker");

				//	Move colon.
				(speaker.querySelector("strong") ?? speaker).innerHTML += nextNode.textContent.slice(0, 1) + " ";
				nextNode.textContent = nextNode.textContent.slice(1).trimStart();
			}
		}

		unwrap(interviewWrapper);
	});
}, "rewrite");

/*************************************************************************/
/*	Returns the nesting level (an integer in [1,blockquoteCyclePeriod]) of 
	a <blockquote> element.
 */
function blockquoteLevel(blockquote) {
	if (blockquote?.tagName != "BLOCKQUOTE")
		return 0;

	let prefix = "blockquote-level-";

	return (parseInt(Array.from(blockquote.classList).find(c => c.startsWith(prefix))?.slice(prefix.length)) || 1);
}

/*******************************************************************/
/*	Sets CSS class matching nesting level of a <blockquote> element.
 */
function setBlockquoteLevel(blockquote, level) {
	if (blockquote?.tagName != "BLOCKQUOTE")
		return;

	let prefix = "blockquote-level-";

	blockquote.swapClasses([ Array.from(blockquote.classList).find(c => c.startsWith(prefix)), `${prefix}${level}` ], 1);
}

/******************************************/
/*  Designate blockquote level via a class.
 */
addContentInjectHandler(GW.contentInjectHandlers.designateBlockquoteLevels = (eventInfo) => {
    GWLog("designateBlockquoteLevels", "rewrite.js", 1);

	let blockquoteCyclePeriod = 6;
	eventInfo.container.querySelectorAll("blockquote").forEach(blockquote => {
		setBlockquoteLevel(blockquote, (blockquoteLevel(blockquote.parentElement?.closest("blockquote")) % blockquoteCyclePeriod) + 1);
	});
}, ">rewrite");


/**********/
/* TABLES */
/**********/

/**************************************************************************/
/*  If there are tables, import tablesorter.js (if need be) and make tables
    sortable.
 */
addContentInjectHandler(GW.contentInjectHandlers.makeTablesSortable = (eventInfo) => {
    GWLog("makeTablesSortable", "rewrite.js", 1);

    if (eventInfo.container.querySelector("table") == null)
        return;

    //  Import tablesorter.js, if need be.
    let scriptTag = document.querySelector("script[src*='/static/js/tablesorter.js']");
    if (scriptTag == null) {
        scriptTag = newElement("SCRIPT", {
            "type": "text/javascript",
            "src": "/static/js/tablesorter.js"
        });
        document.body.appendChild(scriptTag);
    }

    let sortTables = (eventInfo) => {
        jQuery("table", eventInfo.document).tablesorter();
    };

    if (window["jQuery"]) {
        sortTables(eventInfo);
    } else {
        GW.notificationCenter.addHandlerForEvent("Tablesorter.didLoad", (info) => {
            sortTables(eventInfo);
        }, { once: true });
    }
});

/************************************************************************/
/*  Wrap each table in a div.table-wrapper and a div.table-scroll-wrapper
    (for layout purposes).
 */
addContentLoadHandler(GW.contentLoadHandlers.wrapTables = (eventInfo) => {
    GWLog("wrapTables", "rewrite.js", 1);

    wrapAll("table", "table-wrapper", "DIV", eventInfo.container, true);
    wrapAll("table", "table-scroll-wrapper", "DIV", eventInfo.container, false);

    eventInfo.container.querySelectorAll(".table-scroll-wrapper").forEach(tableScrollWrapper => {
        transferClasses(tableScrollWrapper.closest(".table-wrapper"), tableScrollWrapper, [ "width-full" ]);
    });
}, "rewrite");

/********************************************************************/
/*  Rectify wrapper structure of full-width tables:

    div.table-wrapper.table.width-full
        div.table-scroll-wrapper
            table

    or

    div.table-wrapper.collapse
        div.collapse-content-wrapper.table.width-full
            div.table-scroll-wrapper
                table
 */
addContentInjectHandler(GW.contentInjectHandlers.wrapFullWidthTables = (eventInfo) => {
    GWLog("wrapFullWidthTables", "rewrite.js", 1);

    wrapAll(".table-wrapper .width-full", "table width-full", "DIV", eventInfo.container, true, [ "width-full" ]);
}, "rewrite", (info) => info.fullWidthPossible);


/***********/
/* FIGURES */
/***********/

/******************************************************************/
/*	Wrap text nodes and inline elements in figcaptions in <p> tags.
 */
addContentLoadHandler(GW.contentLoadHandlers.paragraphizeFigcaptionTextNodes = (eventInfo) => {
    GWLog("paragraphizeFigcaptionTextNodes", "rewrite.js", 1);

	eventInfo.container.querySelectorAll(selectorize([ "figcaption" ])).forEach(paragraphizeTextNodesOfElement);
}, "rewrite");

/***************************************************************************/
/*  Make sure that the figcaption, alt-text, and title are, collectively, as
    useful as possible (i.e., ensure that neither the alt-text nor the title
    duplicate the contents of the figcaption).
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyImageAuxText = (eventInfo) => {
    GWLog("rectifyImageAuxText", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("figure img").forEach(image => {
        let figcaption = image.closest("figure").querySelector("figcaption");
        if (figcaption == null)
            return;

        let [ captionText, titleText, altText ] = [
            figcaption.cloneNode(true),
            newElement("SPAN", null, { "innerHTML": image.getAttribute("title") }),
            newElement("SPAN", null, { "innerHTML": image.getAttribute("alt") }),
        ].map(element => {
            if (element)
                Typography.processElement(element, Typography.replacementTypes.CLEAN|Typography.replacementTypes.QUOTES);

            return element.textContent.trim();
        });

        if (titleText == captionText)
            image.title = altText;

        if (altText == captionText)
            image.alt = titleText;
    });
}, "rewrite");

/*******************************/
/*  Wrap bare images in figures.
 */
addContentLoadHandler(GW.contentLoadHandlers.wrapImages = (eventInfo) => {
    GWLog("wrapImages", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("p > img:only-child").forEach(image => {
        unwrap(image.parentElement);
    });

    let exclusionSelector = ".footnote-back, td, th";
    wrapAll("img", (image) => {
        if (   image.classList.contains("figure-not")
            || image.closest(exclusionSelector))
            return;

        let figure = image.closest("figure");
        if (   figure
            && figure.querySelector("figcaption") != null)
            return;

        wrapElement(image, null, "FIGURE", true, false);
    }, null, eventInfo.container);
}, "rewrite");

/*****************************************************************************/
/*  Sets, in CSS, the image dimensions that are specified in HTML.
 */
function setImageDimensions(image, fixWidth = false, fixHeight = false) {
    let width = image.getAttribute("width");
    let height = image.getAttribute("height");

    image.style.aspectRatio = `${width} / ${height}`;

	if (image.maxHeight == null) {
		//	This should match `1rem`.
		let baseFontSize = GW.isMobile() ? "18" : "20";

		/*	This should match the `max-height` property value for all images in
			figures (the `figure img` selector; see initial.css).
		 */
		image.maxHeight = window.innerHeight - (8 * baseFontSize);
	}

    if (image.maxHeight)
        width = Math.round(Math.min(width, image.maxHeight * (width/height)));

    if (fixWidth) {
        image.style.width = `${width}px`;
    }
    if (fixHeight) {
        //  Nothing, for now.
    }
}

/**********************************************************/
/*  Prevent reflow in annotations, reduce reflow elsewhere.
 */
addContentLoadHandler(GW.contentLoadHandlers.setImageDimensions = (eventInfo) => {
    GWLog("setImageDimensions", "rewrite.js", 1);

	//	Do not set image dimensions in sidenotes.
	if (eventInfo.container == Sidenotes.hiddenSidenoteStorage)
		return;

    eventInfo.container.querySelectorAll("figure img[width][height]").forEach(image => {
        let fixWidth = (   eventInfo.contentType == "annotation"
                        && (   image.classList.containsAnyOf([ "float-left", "float-right" ])
                        	|| image.closest("figure")?.classList.containsAnyOf([ "float-left", "float-right" ])));
        setImageDimensions(image, fixWidth);
    });

    //  Also ensure that SVGs get rendered as big as possible.
    eventInfo.container.querySelectorAll("figure img[src$='.svg']").forEach(svg => {
        svg.style.width = "100vw";
        svg.style.aspectRatio = svg.dataset.aspectRatio;
    });
}, "rewrite");

/********************************************/
/*  Prevent reflow due to lazy-loaded images.
 */
addContentInjectHandler(GW.contentInjectHandlers.updateImageDimensions = (eventInfo) => {
    GWLog("updateImageDimensions", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("figure img[width][height][loading='lazy']").forEach(image => {
        setImageDimensions(image, true);
    });
}, "rewrite");

/*********************************************************/
/*  Ensure image dimensions update when device is rotated.
 */
addContentInjectHandler(GW.contentInjectHandlers.addOrientationChangeImageDimensionUpdateEvents = (eventInfo) => {
    GWLog("addOrientationChangeImageDimensionUpdateEvents", "rewrite.js", 1);

	let images = eventInfo.container.querySelectorAll("figure img[width][height]");

	doWhenMatchMedia(GW.mediaQueries.portraitOrientation, "Rewrite.updateImageDimensionsWhenOrientationChanges", (mediaQuery) => {
		images.forEach(image => {
			image.maxHeight = null;
		});
		requestAnimationFrame(() => {
			images.forEach(image => {
				image.style.width = "";
				setImageDimensions(image, true);
			});
		});
	});
}, "eventListeners");

/********************************/
/*  Inject wrappers into figures.
 */
addContentLoadHandler(GW.contentLoadHandlers.wrapFigures = (eventInfo) => {
    GWLog("wrapFigures", "rewrite.js", 1);

    let mediaSelector = "img, audio, video";

    eventInfo.container.querySelectorAll("figure").forEach(figure => {
        let media = figure.querySelector(mediaSelector);
        let caption = figure.querySelector("figcaption");

        if (!(media && caption))
            return;

        //  Create an inner wrapper for the figure contents.
        let innerWrapper = newElement("SPAN", { "class": "figure-inner-wrapper" });
        figure.appendChild(innerWrapper);

        //  Re-insert the (possibly wrapped) media into the figure.
        figure.querySelectorAll(mediaSelector).forEach(mediaElement => {
            let mediaBlock = mediaElement.closest(".image-wrapper") || mediaElement;
            innerWrapper.appendChild(mediaBlock);
        });

        //  Wrap the caption in the wrapper span.
        let captionWrapper = newElement("SPAN", { "class": "caption-wrapper" });
        captionWrapper.appendChild(caption);

        //  Re-insert the wrapped caption into the figure.
        innerWrapper.appendChild(captionWrapper);
    });
}, "rewrite");

/*****************************************************************************/
/*	Allow for specifying figure classes by setting classes on a media element.
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyFigureClasses = (eventInfo) => {
    GWLog("rectifyFigureClasses", "rewrite.js", 1);

    let mediaSelector = "img, audio, video";

    eventInfo.container.querySelectorAll("figure").forEach(figure => {
        let media = figure.querySelector(mediaSelector);

        //  Tag the figure with the first (or only) media element’s classes.
        [ "float-left", "float-right", "outline-not", "image-focus-not" ].forEach(imgClass => {
            if (media.classList.contains(imgClass)) {
                figure.classList.add(imgClass);
				media.classList.remove(imgClass);
			}
        });

		media.classList.remove("float");
    });
}, "rewrite");

/********************************/
/*  Don’t float solitary figures.
 */
addContentInjectHandler(GW.contentInjectHandlers.deFloatSolitaryFigures = (eventInfo) => {
    GWLog("deFloatSolitaryFigures", "rewrite.js", 1);

    let floatClasses = [ "float-left", "float-right" ];
    eventInfo.container.querySelectorAll(floatClasses.map(x => `figure.${x}:only-child`).join(", ")).forEach(figure => {
        if (isOnlyChild(figure))
            figure.classList.remove(...floatClasses);
    });
}, "rewrite");

/********************************************************************/
/*  Designate full-width figures as such (with a ‘width-full’ class).
 */
addContentInjectHandler(GW.contentInjectHandlers.prepareFullWidthFigures = (eventInfo) => {
    GWLog("prepareFullWidthFigures", "rewrite.js", 1);

    let fullWidthClass = "width-full";

    let allFullWidthMedia = eventInfo.container.querySelectorAll(`img.${fullWidthClass}, video.${fullWidthClass}`);
    allFullWidthMedia.forEach(fullWidthMedia => {
        fullWidthMedia.closest("figure").classList.toggle(fullWidthClass, true);
    });

    //  Constrain caption width to width of media element.
    let constrainCaptionWidth = (fullWidthMedia) => {
        let caption = fullWidthMedia.closest("figure").querySelector(".caption-wrapper");
        if (caption)
            caption.style.maxWidth = fullWidthMedia.offsetWidth > 0
                                     ? fullWidthMedia.offsetWidth + "px"
                                     : fullWidthMedia.closest(".markdownBody").offsetWidth + "px";
    };

    //  Add ‘load’ listener for lazy-loaded media.
    allFullWidthMedia.forEach(fullWidthMedia => {
        fullWidthMedia.addEventListener("load", fullWidthMedia.loadListener = (event) => {
            constrainCaptionWidth(fullWidthMedia);
            fullWidthMedia.loadListener = null;
        }, { once: true });
    });

    /*  Re-add ‘load’ listener for lazy-loaded media (as it might cause
        re-layout of e.g. sidenotes). Do this only after page layout is
        complete, to avoid spurious re-layout at initial page load.
     */
    doWhenPageLayoutComplete(() => {
        allFullWidthMedia.forEach(fullWidthMedia => {
            constrainCaptionWidth(fullWidthMedia);
            if (fullWidthMedia.loadListener) {
                fullWidthMedia.removeEventListener("load", fullWidthMedia.loadListener);
                fullWidthMedia.addEventListener("load", (event) => {
                    constrainCaptionWidth(fullWidthMedia);
                    GW.notificationCenter.fireEvent("Rewrite.fullWidthMediaDidLoad", {
                        mediaElement: fullWidthMedia
                    });
                }, { once: true });
            }
        });
        //  Add listener to update caption max-width when window resizes.
        addWindowResizeListener(event => {
            allFullWidthMedia.forEach(constrainCaptionWidth);
        }, "constrainFullWidthMediaCaptionWidthResizeListener");
    });
}, "rewrite", (info) => info.fullWidthPossible);

/*****************************************************************/
/*  Allow for floated figures at the start of annotation abstracts
    (only on sufficiently wide viewports).
 */
addContentLoadHandler(GW.contentLoadHandlers.relocateThumbnailInAnnotation = (eventInfo) => {
    GWLog("relocateThumbnailInAnnotation", "rewrite.js", 1);

    if (GW.mediaQueries.mobileWidth.matches)
        return;

    let annotationAbstract = eventInfo.container.querySelector(".annotation-abstract");
    if (   annotationAbstract == null
        || annotationAbstract.tagName == "BLOCKQUOTE")
        return;

    let container = annotationAbstract.closest(".annotation");
    if (   container == null
        || container == annotationAbstract)
        return;

    let initialFigure = annotationAbstract.querySelector(".annotation-abstract > figure.float-right:first-child");
    if (initialFigure == null) {
        let pageThumbnailImage = annotationAbstract.querySelector("img.page-thumbnail");
        if (pageThumbnailImage)
            initialFigure = pageThumbnailImage.closest("figure");
    }
    if (initialFigure)
        container.insertBefore(initialFigure, container.firstElementChild);
}, "rewrite");

/****************************************************************/
/*  Account for interaction between image-focus.js and popups.js.
 */
GW.notificationCenter.addHandlerForEvent("ImageFocus.imageOverlayDidAppear", (info) => {
    if (Extracts.popFrameProvider == Popups)
        Popups.hidePopupContainer();
});
GW.notificationCenter.addHandlerForEvent("ImageFocus.imageOverlayDidDisappear", (info) => {
    if (Extracts.popFrameProvider == Popups)
        Popups.unhidePopupContainer();
});



/***************/
/* CODE BLOCKS */
/***************/

/*************************************************************/
/*	Wrap each <pre> in a div.sourceCode (for layout purposes).
 */
addContentLoadHandler(GW.contentLoadHandlers.wrapPreBlocks = (eventInfo) => {
    GWLog("wrapPreBlocks", "rewrite.js", 1);

	wrapAll("pre", "sourceCode", "DIV", eventInfo.container, true, false);
}, "rewrite");

/*****************************************************************************/
/*	Allow for specifying code block classes by setting classes on the <pre>.
	(Workaround for a Pandoc peculiarity where classes set on a code block
	 are applied to the <pre> element and not on the div.sourceCode wrapper.)
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyCodeBlockClasses = (eventInfo) => {
    GWLog("rectifyCodeBlockClasses", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("pre").forEach(preBlock => {
        let wrapper = preBlock.closest("div.sourceCode");

        //  Tag the wrapper with the <pre>’s classes.
        [ "float-left", "float-right" ].forEach(preClass => {
            if (preBlock.classList.contains(preClass)) {
                wrapper.classList.add(preClass);
				preBlock.classList.remove(preClass);
			}
        });

		preBlock.classList.remove("float");
    });
}, "rewrite");

/**********************************************************************/
/*  Wrap each pre.width-full in a div.width-full (for layout purposes).
 */
addContentInjectHandler(GW.contentInjectHandlers.wrapFullWidthPreBlocks = (eventInfo) => {
    GWLog("wrapFullWidthPreBlocks", "rewrite.js", 1);

    wrapAll("pre.width-full", "width-full", "DIV", eventInfo.container, true, false);
}, "rewrite", (info) => info.fullWidthPossible);


/***********/
/* COLUMNS */
/***********/

/*****************************************/
/*  Disable columns if only one list item.
 */
addContentLoadHandler(GW.contentLoadHandlers.disableSingleItemColumnBlocks = (eventInfo) => {
    GWLog("disableSingleItemColumnBlocks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".columns > ul").forEach(columnList => {
        if (columnList.children.length == 1)
            columnList.parentElement.classList.remove("columns");
    });
}, "rewrite");


/****************/
/* MARGIN NOTES */
/****************/

/*************************************************************/
/*  Wrap the contents of all margin notes in an inner wrapper.
 */
addContentLoadHandler(GW.contentLoadHandlers.wrapMarginNotes = (eventInfo) => {
    GWLog("wrapFullWidthPreBlocks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".marginnote").forEach(marginnote => {
        let innerWrapper = newElement("SPAN", { "class": "marginnote-inner-wrapper" });
        innerWrapper.append(...marginnote.childNodes);
        marginnote.append(innerWrapper);
    });
}, "rewrite");

/**************************/
/*	Aggregate margin notes.
 */
addContentLoadHandler(GW.contentLoadHandlers.aggregateMarginNotes = (eventInfo) => {
    GWLog("aggregateMarginNotes", "rewrite.js", 1);

	aggregateMarginNotesIfNeeded(eventInfo);
}, "rewrite");


/**************/
/* TYPOGRAPHY */
/**************/

/***********************************/
/*	Rectify typography in body text.

	NOTE: This should be temporary. Word breaks after slashes should be added
	in body text on the back end, at content build time. But that is currently
	not working, hence this temporary client-side solution.
	—SA 2023-09-13
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyTypographyInBodyText = (eventInfo) => {
    GWLog("rectifyTypographyInBodyText", "rewrite.js", 1);

	eventInfo.container.querySelectorAll("p").forEach(graf => {
		Typography.processElement(graf, Typography.replacementTypes.WORDBREAKS);
	});
}, "rewrite");

/******************************************************************************/
/*  Remove extraneous whitespace-only text nodes from between the element parts
    of a .cite (citation element).
 */
addContentLoadHandler(GW.contentLoadHandlers.removeExtraneousWhitespaceFromCitations = (eventInfo) => {
    GWLog("removeExtraneousWhitespaceFromCitations", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".cite").forEach(citation => {
        Array.from(citation.children).forEach(citationPart => {
            if (   citationPart.nextSibling
                && citationPart.nextSibling.nodeType == Node.TEXT_NODE
                && isNodeEmpty(citationPart.nextSibling))
                citationPart.nextSibling.remove();
        });
    });
}, "rewrite");

/******************************************************************/
/*  Configure Hyphenopoly.

    Requires Hyphenopoly_Loader.js to be loaded prior to this file.
 */
Hyphenopoly.config({
    require: {
        "en-us": "FORCEHYPHENOPOLY"
    },
    setup: {
        hide: "none",
        keepAlive: true,
        safeCopy: false
    }
});

/**********************************************/
/*  Hyphenate with Hyphenopoly.

    Requires Hyphenopoly_Loader.js to be loaded prior to this file.
 */
addContentInjectHandler(GW.contentInjectHandlers.hyphenate = (eventInfo) => {
    GWLog("hyphenate", "rewrite.js", 1);

    if (!(Hyphenopoly.hyphenators))
        return;

    if (GW.isX11())
        return;

    let selector = (GW.isMobile()
                    ? ".markdownBody p"
                    : (eventInfo.document == document
                       ? ".sidenote p, .abstract blockquote p"
                       : "p"));
    let blocks = eventInfo.container.querySelectorAll(selector);
    Hyphenopoly.hyphenators.HTML.then((hyphenate) => {
        blocks.forEach(block => {
            hyphenate(block);
            Typography.processElement(block, Typography.replacementTypes.NONE, true);
        });
    });
}, "rewrite");

/************************************************************************/
/*  Remove soft hyphens and other extraneous characters from copied text.
 */
addCopyProcessor((event, selection) => {
    Typography.processElement(selection, Typography.replacementTypes.CLEAN);

    return true;
});

/*****************************************************************************/
/*  Makes it so that copying an author-date citation (e.g. `Foo et al 2001`)
    interact properly with copy-paste when rendered with pseudo-element ellipses
    (`Foo...2001`).
 */
addCopyProcessor((event, selection) => {
    /*  Set `display` of all `span.cite-joiner` to `initial` (overriding the
        default of `none`) so that their contents are included in the
        content properties of the selection); inject surrounding spaces.
     */
    selection.querySelectorAll(".cite-joiner").forEach(citeJoiner => {
        citeJoiner.style.display = "initial";
        citeJoiner.innerHTML = ` ${citeJoiner.innerHTML} `;
    });

	/*	Inject preceding space when a span.cite-date follows immediately after
		a span.cite-author (i.e., there is no span.cite-joiner, because there
		are no more than two authors).
	 */
    selection.querySelectorAll(".cite-author + .cite-date").forEach(citeDateAfterAuthor => {
    	citeDateAfterAuthor.innerHTML = ` ${citeDateAfterAuthor.innerHTML}`;
    });

    return true;
});


/*********************/
/* FULL-WIDTH BLOCKS */
/*********************/

/*******************************************************************************/
/*  Expands all tables (& other blocks) whose wrapper block is marked with class
    ‘width-full’, and all figures marked with class ‘width-full’, to span the
    viewport (minus a specified margin on both sides).
 */
function createFullWidthBlockLayoutStyles() {
    GWLog("createFullWidthBlockLayoutStyles", "rewrite.js", 1);

    /*  Configuration and dynamic value storage.
     */
    GW.fullWidthBlockLayout = {
        sideMargin: 25,
        pageWidth: 0,
        leftAdjustment: 0
    };

    /*  Pre-query key elements, to save performance on resize.
     */
    let rootElement = document.querySelector("html");
    let markdownBody = document.querySelector("#markdownBody");

    /*  Inject styles block to hold dynamically updated layout variables.
     */
    let fullWidthBlockLayoutStyles = document.querySelector("head").appendChild(newElement("STYLE", { id: "full-width-block-layout-styles" }));

    /*  Function to update layout variables (called immediately and on resize).
     */
    let updateFullWidthBlockLayoutStyles = (event) => {
        GWLog("updateFullWidthBlockLayoutStyles", "rewrite.js", 2);

        GW.fullWidthBlockLayout.pageWidth = rootElement.offsetWidth;

        let markdownBodyRect = markdownBody.getBoundingClientRect();
        let markdownBodyRightMargin = GW.fullWidthBlockLayout.pageWidth - markdownBodyRect.right;
        GW.fullWidthBlockLayout.leftAdjustment = markdownBodyRect.left - markdownBodyRightMargin;

        fullWidthBlockLayoutStyles.innerHTML = `:root {
            --GW-full-width-block-layout-side-margin: ${GW.fullWidthBlockLayout.sideMargin}px;
            --GW-full-width-block-layout-page-width: ${GW.fullWidthBlockLayout.pageWidth}px;
            --GW-full-width-block-layout-left-adjustment: ${GW.fullWidthBlockLayout.leftAdjustment}px;
        }`;
    };
    updateFullWidthBlockLayoutStyles();

    //  Add listener to update layout variables on window resize.
    addWindowResizeListener(updateFullWidthBlockLayoutStyles, "updateFullWidthBlockLayoutStylesResizeListener");
}

GW.notificationCenter.addHandlerForEvent("GW.pageLayoutWillComplete", (info) => {
    createFullWidthBlockLayoutStyles();
});

/************************************/
/*  Set margins of full-width blocks.
 */
addContentInjectHandler(GW.contentInjectHandlers.setMarginsOnFullWidthBlocks = (eventInfo) => {
    GWLog("setMarginsOnFullWidthBlocks", "rewrite.js", 1);

    //  Get all full-width blocks in the given document.
    let allFullWidthBlocks = eventInfo.container.querySelectorAll("div.width-full, figure.width-full");

    let removeFullWidthBlockMargins = () => {
        allFullWidthBlocks.forEach(fullWidthBlock => {
            fullWidthBlock.style.marginLeft = "";
            fullWidthBlock.style.marginRight = "";
        });
    };

    if (eventInfo.fullWidthPossible == false) {
        removeFullWidthBlockMargins();
        return;
    }

    //  Un-expand when mobile width, expand otherwise.
    doWhenMatchMedia(GW.mediaQueries.mobileWidth, "updateFullWidthBlockExpansionForCurrentWidthClass", () => {
        removeFullWidthBlockMargins();
    }, () => {
        allFullWidthBlocks.forEach(fullWidthBlock => {
            fullWidthBlock.style.marginLeft = `calc(
                                                    (-1 * (var(--GW-full-width-block-layout-left-adjustment) / 2.0))
                                                  + (var(--GW-full-width-block-layout-side-margin))
                                                  - ((var(--GW-full-width-block-layout-page-width) - 100%) / 2.0)
                                                )`;
            fullWidthBlock.style.marginRight = `calc(
                                                     (var(--GW-full-width-block-layout-left-adjustment) / 2.0)
                                                   + (var(--GW-full-width-block-layout-side-margin))
                                                   - ((var(--GW-full-width-block-layout-page-width) - 100%) / 2.0)
                                                )`;
        });
    });
}, ">rewrite");


/***************/
/* ANNOTATIONS */
/***************/

/******************************************************************************/
/*  Transform title-link of truncated annotations (i.e., full annotations
    transcluded as partial annotations) to allow access to the full annotation.
 */
addContentLoadHandler(GW.contentLoadHandlers.rewriteTruncatedAnnotations = (eventInfo) => {
    GWLog("rewriteTruncatedAnnotations", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".annotation-partial").forEach(partialAnnotation => {
        //  Check to see whether the abstract exists.
        if (Annotations.referenceDataForLink(eventInfo.includeLink).content.abstract == null)
            return;

		//	Remove colon.
		partialAnnotation.querySelector(".data-field.author-date-aux").lastTextNode.nodeValue = ")";

        //  Rewrite title-link.
        let titleLink = partialAnnotation.querySelector("a.title-link");
        titleLink.classList.add(Annotations.annotatedLinkFullClass);
    });
}, "<rewrite", (info) => (   info.source == "transclude"
                          && info.contentType == "annotation"));

/*****************************************************************/
/*  Partial annotations, defined inline (in directories and such).
 */
addContentLoadHandler(GW.contentLoadHandlers.rewritePartialAnnotations = (eventInfo) => {
    GWLog("rewritePartialAnnotations", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".annotation-partial").forEach(partialAnnotation => {
        //  If already done, do not redo.
        if (partialAnnotation.firstElementChild.classList.contains("data-field"))
            return;

        //  Identify reference link.
        let referenceLink = partialAnnotation.querySelector("a");

        //  If already in progress, do not interfere.
        if (Transclude.isIncludeLink(referenceLink))
            return;

        //  Designate reference link, for annotations.js to identify it.
        referenceLink.classList.add("link-annotated-partial");

        //  Load data into Annotations.
        Annotations.cacheAPIResponseForLink(newDocument(partialAnnotation),
                                            referenceLink);

        //  Replace reference block contents with synthetic include-link.
        partialAnnotation.replaceChildren(synthesizeIncludeLink(referenceLink, {
            "class": "include-annotation include-replace-container link-annotated-partial",
            "data-template-fields": "annotationClassSuffix:$",
            "data-annotation-class-suffix": "-partial"
        }));

        //  Fire GW.contentDidLoadEvent (to trigger transclude).
        GW.notificationCenter.fireEvent("GW.contentDidLoad", {
            source: "rewritePartialAnnotations",
            container: partialAnnotation,
            document: eventInfo.document,
            loadLocation: eventInfo.loadLocation
        });
    });
}, "rewrite");

/***************************************************************************/
/*  Make the page thumbnail in an annotation load eagerly instead of lazily.
 */
addContentLoadHandler(GW.contentLoadHandlers.setEagerLoadingForAnnotationImages = (eventInfo) => {
    GWLog("setEagerLoadingForAnnotationImages", "rewrite.js", 1);

    let firstImage = (eventInfo.container.querySelector(".page-thumbnail"))
    if (firstImage) {
        firstImage.loading = "eager";
        firstImage.decoding = "sync";
    }
}, "rewrite", (info) => (info.contentType == "annotation"));

/***************************************************************************/
/*  Because annotations transclude aux-links, we make the aux-links links in
    the metadata line of annotations scroll down to the appended aux-links
    blocks.
 */
addContentInjectHandler(GW.contentInjectHandlers.rewriteAuxLinksLinksInTranscludedAnnotations = (eventInfo) => {
    GWLog("rewriteAuxLinksLinksInTranscludedAnnotations", "rewrite.js", 1);

    let annotation = eventInfo.container.querySelector(".annotation");
    if (annotation == null)
        return;

    let inPopFrame = (Extracts.popFrameProvider.containingPopFrame(annotation) != null);

    annotation.querySelectorAll(".data-field.aux-links a.aux-links").forEach(auxLinksLink => {
        let auxLinksLinkType = AuxLinks.auxLinksLinkType(auxLinksLink);
        let includedAuxLinksBlock = annotation.querySelector(`.${auxLinksLinkType}-append`);
        if (includedAuxLinksBlock) {
            auxLinksLink.onclick = () => { return false; };
            auxLinksLink.addActivateEvent((event) => {
                if (includedAuxLinksBlock.querySelector("ul, ol") == null) {
                    GW.notificationCenter.addHandlerForEvent("GW.contentDidInject", (info) => {
                        revealElement(includedAuxLinksBlock);
                    }, { once: true });
                }

                revealElement(includedAuxLinksBlock);

                return false;
            });
        }
    });
}, "eventListeners", (info) => (info.contentType == "annotation"));

/*******************************************************************************/
/*  Apply various typographic fixes (educate quotes, inject <wbr> elements after
    certain problematic characters, etc.).

    Requires typography.js to be loaded prior to this file.
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyTypographyInAnnotation = (eventInfo) => {
    GWLog("rectifyTypographyInAnnotation", "rewrite.js", 1);

    Typography.processElement(eventInfo.container,
        (  Typography.replacementTypes.QUOTES
         | Typography.replacementTypes.WORDBREAKS
         | Typography.replacementTypes.ELLIPSES),
        true);

    //  Educate quotes in image alt-text.
    eventInfo.container.querySelectorAll("img").forEach(image => {
        image.alt = Typography.processString(image.alt, Typography.replacementTypes.QUOTES);
    });
}, "rewrite", (info) => (info.contentType == "annotation"));

/******************************************************************************/
/*  Bind mouse hover events to, when hovering over an annotated link, highlight
    that annotation (as viewed in a tags directory, for instance).
 */
addContentInjectHandler(GW.contentInjectHandlers.bindSectionHighlightEventsToAnnotatedLinks = (eventInfo) => {
    GWLog("bindSectionHighlightEventsToAnnotatedLinks", "rewrite.js", 1);

    Annotations.allAnnotatedLinksInContainer(eventInfo.container).forEach(annotatedLink => {
        //  Unbind existing events, if any.
        if (annotatedLink.annotatedLinkMouseEnter)
            annotatedLink.removeEventListener("mouseenter", annotatedLink.annotatedLinkMouseEnter);
        if (annotatedLink.annotatedLinkMouseLeave)
            annotatedLink.removeEventListener("mouseleave", annotatedLink.annotatedLinkMouseLeave);

        //  Bind events.
        let escapedLinkURL = CSS.escape(decodeURIComponent(annotatedLink.href));
        let targetAnalogueInLinkBibliography = document.querySelector(`a[id^='link-bibliography'][href='${escapedLinkURL}']`);
        if (   targetAnalogueInLinkBibliography
            && targetAnalogueInLinkBibliography != annotatedLink) {
            let containingSection = targetAnalogueInLinkBibliography.closest("section");
            if (containingSection) {
                annotatedLink.addEventListener("mouseenter", annotatedLink.annotatedLinkMouseEnter = (event) => {
                    clearTimeout(containingSection.highlightFadeTimer);
                    containingSection.classList.toggle("highlight-fading", false);
                    containingSection.classList.toggle("highlighted", true);
                });
                annotatedLink.addEventListener("mouseleave", annotatedLink.annotatedLinkMouseLeave = (event) => {
                    containingSection.classList.toggle("highlight-fading", true);
                    containingSection.highlightFadeTimer = setTimeout(() => {
                        containingSection.classList.toggle("highlight-fading", false);
                        containingSection.classList.toggle("highlighted", false);
                    }, 150);
                });
            }
        }
    });
}, "eventListeners");


/*********************/
/* LINK BIBLIOGRAPHY */
/*********************/

/*********************************************************************/
/*  Remove the “Link Bibliography:” bold text when transcluding a link
    bibliography into a page’s Link Bibliography section.
 */
addContentInjectHandler(GW.contentInjectHandlers.removeSubheadingFromLinkBibliography = (eventInfo) => {
    GWLog("removeSubheadingFromLinkBibliography", "rewrite.js", 1);

    if (eventInfo.container.closest("section#link-bibliography-section")) {
        let subheading = eventInfo.container.querySelector("#link-bibliography > .aux-links-list-label");
        if (subheading)
            subheading.remove();
    }
}, "rewrite", (info) => (info.source == "transclude"));

/*****************************************************************************/
/*  Apply a class to those link-bibs that should use the more compact styling.
 */
addContentInjectHandler(GW.contentInjectHandlers.applyLinkBibliographyCompactStylingClass = (eventInfo) => {
    GWLog("applyLinkBibliographyCompactStylingClass", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".link-bibliography-list").forEach(linkBibList => {
        if (linkBibList.closest("li, .link-bibliography-append, .popframe-body.link-bibliography"))
            linkBibList.classList.add("link-bibliography-list-compact");
    });
}, "rewrite");


/*********************/
/* TABLE OF CONTENTS */
/*********************/

/******************************************************************/
/*  Sets TOC collapse state and updates the collapse toggle button.
 */
function setTOCCollapseState(collapsed = false) {
    let TOC = document.querySelector("#TOC");
    if (!TOC)
        return;

    TOC.classList.toggle("collapsed", collapsed);

    let button = TOC.querySelector(".toc-collapse-toggle-button");
    if (!button)
        return;

    button.title = collapsed ? "Expand table of contents" : "Collapse table of contents";
}

/*******************************************************/
/*  Add the collapse toggle button to the main page TOC.
 */
addContentLoadHandler(GW.contentLoadHandlers.injectTOCMinimizeButton = (eventInfo) => {
    GWLog("injectTOCMinimizeButton", "rewrite.js", 1);

    let TOC = document.querySelector("#TOC");
    if (!TOC)
        return;

    let button = newElement("BUTTON", {
        "class": "toc-collapse-toggle-button",
        "title": "Collapse table of contents",
        "tabindex": "-1"
    }, {
        "innerHTML": `<span>${(GW.svg("chevron-left-solid"))}</span>`
    });
    TOC.appendChild(button);

    let defaultTOCCollapseState = "false";
    setTOCCollapseState((localStorage.getItem("toc-collapsed") ?? defaultTOCCollapseState) == "true");

    button.addActivateEvent((event) => {
        setTOCCollapseState(TOC.classList.contains("collapsed") == false);
        localStorage.setItem("toc-collapsed", TOC.classList.contains("collapsed"));
    });
}, "rewrite", (info) => (info.container == document.body));

/***************************************************************************/
/*  Strip spurious <span> tags (unavoidably added by Pandoc) from TOC links.
 */
addContentLoadHandler(GW.contentLoadHandlers.stripTOCLinkSpans = (eventInfo) => {
    GWLog("stripTOCLinkSpans", "rewrite.js", 1);

    unwrapAll(".TOC li a > span:not([class])", eventInfo.container);
}, "rewrite");

/**************************************************************************/
/*  Update main page TOC with any sections within the initially loaded page
    that don’t already have TOC entries.
 */
addContentLoadHandler(GW.contentLoadHandlers.updateMainPageTOC = (eventInfo) => {
    GWLog("updateMainPageTOC", "rewrite.js", 1);

    updatePageTOCIfNeeded(eventInfo);
}, "rewrite", (info) => (info.container == document.body));

/*************************************************/
/*  Apply typography rectification to TOC entries.
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifyTypographyInTOC = (eventInfo) => {
    GWLog("rectifyTypographyInTOC", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".TOC").forEach(TOC => {
        Typography.processElement(TOC, Typography.replacementTypes.WORDBREAKS, true);
    });
}, "rewrite");

/**********************************************************/
/*  Disable link decoration (underlining) on all TOC links.
 */
addContentLoadHandler(GW.contentLoadHandlers.disableTOCLinkDecoration = (eventInfo) => {
    GWLog("disableTOCLinkDecoration", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".TOC a").forEach(link => {
        link.classList.add("decorate-not");
    });
}, "rewrite");

/**********************************************************/
/*  Relocate and clean up TOC on tag directory index pages.
 */
addContentLoadHandler(GW.contentLoadHandlers.rewriteDirectoryIndexTOC = (eventInfo) => {
    GWLog("rewriteDirectoryIndexTOC", "rewrite.js", 1);

    let TOC = eventInfo.container.querySelector("#TOC");
    let seeAlsoSection = eventInfo.container.querySelector("#see-also");

    if (   TOC == null
        || seeAlsoSection == null)
        return;

    /*  Place the TOC after the “See Also” section (which also places it after
        the page abstract, if such exists, because that comes before the
        “See Also” section).
     */
    seeAlsoSection.parentElement.insertBefore(TOC, seeAlsoSection.nextElementSibling);

    //  The “See Also” section no longer needs a TOC entry.
    TOC.querySelector("#toc-see-also").closest("li").remove();

    /*  If “Links” is the only remaining section, then it does not itself need
        a TOC entry; shift its children up one TOC level.
     */
    let linksTOCEntry = TOC.querySelector("#toc-links");
    if (   linksTOCEntry
        && isOnlyChild(linksTOCEntry.closest("li"))) {
        let outerTOCList = TOC.querySelector("ul");
        let innerTOCList = TOC.querySelector("#toc-links + ul");

        TOC.insertBefore(innerTOCList, null);
        outerTOCList.remove();

        //  Mark with special class, for styling purposes.
        TOC.classList.add("TOC-links-only");
    }

	//	Update visibility.
	updateTOCVisibility(TOC);
}, "rewrite", (info) => (   info.container == document.body
                         && /\/(index)?$/.test(location.pathname)));

/*******************************************************************************/
/*	Update visibility of a TOC. (Hide if no entries; if main page TOC, also hide
	if one entry.)
 */
function updateTOCVisibility(TOC) {
    let numEntries = TOC.querySelectorAll("li").length;
    if (   (   TOC.id == "TOC"
            && numEntries <= 1)
        || numEntries == 0) {
        TOC.classList.toggle("hidden", true);
    } else {
        TOC.classList.toggle("hidden", false);
    }
}

/************************************************************************/
/*  If the table of contents has but one entry (or none at all), hide it.
 */
addContentLoadHandler(GW.contentLoadHandlers.updateTOCVisibility = (eventInfo) => {
    GWLog("removeTOCIfSingleEntry", "rewrite.js", 1);

    let TOC = eventInfo.container.querySelector(".TOC");
    if (TOC == null)
        return;

	updateTOCVisibility(TOC);
}, "rewrite");


/*************/
/* FOOTNOTES */
/*************/

/*****************************************************/
/*  Inject self-link for the footnotes section itself.
 */
addContentLoadHandler(GW.contentLoadHandlers.injectFootnoteSectionSelfLink = (eventInfo) => {
    GWLog("injectFootnoteSectionSelfLink", "rewrite.js", 1);

    let footnotesSection = eventInfo.container.querySelector("#footnotes");
    if (!footnotesSection)
        return;

    let footnotesSectionSelfLink = newElement("A", {
        "class": "section-self-link",
        "href": "#footnotes",
        "title": "Link to section: § ‘Footnotes’"
    });

    footnotesSection.insertBefore(footnotesSectionSelfLink, footnotesSection.firstElementChild.nextElementSibling);

    //  Highlight on hover.
    footnotesSectionSelfLink.addEventListener("mouseenter", (event) => {
        footnotesSectionSelfLink.previousElementSibling.classList.toggle("highlighted", true);
    });
    footnotesSectionSelfLink.addEventListener("mouseleave", (event) => {
        footnotesSectionSelfLink.previousElementSibling.classList.toggle("highlighted", false);
    });
}, "rewrite");

/*****************************************/
/*  Add footnote class to footnote blocks.
 */
addContentLoadHandler(GW.contentLoadHandlers.addFootnoteClassToFootnotes = (eventInfo) => {
    GWLog("addFootnoteClassToFootnotes", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("#footnotes > ol > li").forEach(footnote => {
        footnote.classList.add("footnote");
    });
}, "rewrite");

/*****************************************************************************/
/*  Mark hash-targeted footnote with ‘targeted’ class on page load, and update
    when hash changes.
 */
addContentInjectHandler(GW.contentInjectHandlers.markTargetedFootnote = (eventInfo) => {
    GWLog("markTargetedFootnote", "rewrite.js", 1);

    //  Mark target footnote, if any.
    updateFootnoteTargeting();

    //  Add event handler to update targeting again on hash change.
    GW.notificationCenter.addHandlerForEvent("GW.hashDidChange", (info) => {
        updateFootnoteTargeting();
    });
}, "rewrite", (info) => info.container == document.body);

/******************************/
/*  Inject footnote self-links.
 */
addContentLoadHandler(GW.contentLoadHandlers.injectFootnoteSelfLinks = (eventInfo) => {
    GWLog("injectFootnoteSelfLinks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("#footnotes > ol > li").forEach(footnote => {
        if (footnote.querySelector(".footnote-self-link"))
            return;

        let footnoteNumber = Notes.noteNumber(footnote);
        footnote.insertBefore(newElement("A", {
        	href: `#fn${footnoteNumber}`,
        	title: `Link to footnote ${footnoteNumber}`,
        	class: "footnote-self-link"
        }, {
        	innerHTML: "&nbsp;"
        }), footnote.firstChild);
    });
}, "rewrite");

/*****************************************************************/
/*  Rewrite footnote back-to-citation links (generated by Pandoc).
 */
addContentLoadHandler(GW.contentLoadHandlers.rewriteFootnoteBackLinks = (eventInfo) => {
    GWLog("rewriteFootnoteBackLinks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll("#footnotes > ol > li").forEach(footnote => {
        let backlink = footnote.querySelector(".footnote-back");

		if (isOnlyChild(backlink))
			backlink.parentElement.classList.add("footnote-back-block");

        if (backlink.querySelector("svg, .placeholder"))
            return;

        backlink.innerHTML = GW.svg("arrow-hook-left");
    });
}, "rewrite");

/***************************************************************************/
/*  Bind mouse hover events to, when hovering over a citation, highlight all
    {side|foot}notes associated with that citation.
 */
addContentInjectHandler(GW.contentInjectHandlers.bindHighlightEventsToFootnoteSelfLinks = (eventInfo) => {
    GWLog("bindNoteHighlightEventsToCitations", "rewrite.js", 1);

    let allCitations = eventInfo.container.querySelectorAll(".footnote-ref");

    let bindEventsToCitation = (citation) => {
        //  Unbind existing events, if any.
        if (citation.citationMouseEnter)
            citation.removeEventListener("mouseenter", citation.citationMouseEnter);
        if (citation.citationMouseLeave)
            citation.removeEventListener("mouseleave", citation.citationMouseLeave);

        //  Bind events.
        let notesForCitation = Notes.allNotesForCitation(citation);
        citation.addEventListener("mouseenter", citation.citationMouseEnter = (event) => {
            notesForCitation.forEach(note => {
                note.classList.toggle("highlighted", true);
            });
        });
        citation.addEventListener("mouseleave", citation.citationMouseLeave = (event) => {
            notesForCitation.forEach(note => {
                note.classList.toggle("highlighted", false);
            });
        });
    };

    //  Bind events.
    allCitations.forEach(bindEventsToCitation);

    if (allCitations.length > 0) {
        //  Add handler to re-bind events if more notes are injected.
        addContentInjectHandler(GW.contentInjectHandlers.rebindHighlightEventsToFootnoteSelfLinks = (eventInfo) => {
            allCitations.forEach(bindEventsToCitation);
        }, "eventListeners", (info) => (   info.document == document
        								|| info.document == eventInfo.document));
    }
}, "eventListeners");

/******************************************/
/*  Highlight footnote self-links on hover.
 */
addContentInjectHandler(GW.contentInjectHandlers.bindNoteHighlightEventsToCitations = (eventInfo) => {
    GWLog("bindHighlightEventsToFootnoteSelfLinks", "rewrite.js", 1);

    //  Highlight footnote on hover over self-link.
    eventInfo.container.querySelectorAll(".footnote-self-link").forEach(footnoteSelfLink => {
        footnoteSelfLink.addEventListener("mouseenter", (event) => {
            footnoteSelfLink.parentElement.classList.toggle("highlighted", true);
        });
        footnoteSelfLink.addEventListener("mouseleave", (event) => {
            footnoteSelfLink.parentElement.classList.toggle("highlighted", false);
        });
    });
}, "eventListeners");


/*********/
/* LINKS */
/*********/

/**********************************************************************/
/*  Qualify anchorlinks in loaded content by rewriting their `pathname`
    attributes.
 */
addContentInjectHandler(GW.contentInjectHandlers.qualifyAnchorLinks = (eventInfo) => {
    GWLog("qualifyAnchorLinks", "rewrite.js", 1);

    let baseLocation = baseLocationForDocument(eventInfo.document);
    if (baseLocation == null)
        return;

    let loadLocation = (eventInfo.loadLocation ?? baseLocation);

    let exclusionSelector = [
        ".backlink-source"
    ].join(", ");

    eventInfo.container.querySelectorAll("a[href]").forEach(link => {
        if (link.closest(exclusionSelector) != null)
            return;

        if (   (   link.getAttribute("href").startsWith("#")
                || link.pathname == loadLocation.pathname)
                // if initial base page load
            && (   eventInfo.container == document.body
                // if the link refers to an element also in the loaded content
                || eventInfo.container.querySelector(selectorFromHash(link.hash)) != null
                // if the link refers to the loaded content container itself
                || (   eventInfo.container instanceof Element
                    && eventInfo.container.matches(selectorFromHash(link.hash)))
                || (   eventInfo.document.querySelector("#page-metadata") != null
                            // if we’re transcluding a citation (because we merge footnotes)
                    && (   (   eventInfo.source == "transclude"
                            && link.classList.contains("footnote-ref"))
                            // if we’re merging a footnote for transcluded content
                        || (   eventInfo.source == "transclude.footnotes"
                            && link.classList.contains("footnote-back")))))) {
            link.pathname = baseLocation.pathname;
        } else if (link.getAttribute("href").startsWith("#")) {
            link.pathname = loadLocation.pathname;
        }
    });
}, "rewrite");

/********************************************************************/
/*  Designate self-links (a.k.a. anchorlinks) and local links (a.k.a.
    within-site links) as such, via CSS classes.
 */
addContentInjectHandler(GW.contentInjectHandlers.addSpecialLinkClasses = (eventInfo) => {
    GWLog("addSpecialLinkClasses", "rewrite.js", 1);

    let baseLocation = baseLocationForDocument(eventInfo.document);
    if (baseLocation == null)
        return;

    let exclusionSelector = [
        "h1, h2, h3, h4, h5, h6",
        ".section-self-link",
        ".footnote-ref",
        ".footnote-back",
        ".footnote-self-link",
        ".sidenote-self-link",
        ".backlink-context"
    ].join(", ");

    eventInfo.container.querySelectorAll(".markdownBody a[href]").forEach(link => {
        if (   link.hostname != location.hostname
            || link.closest(exclusionSelector))
            return;

        if (   link.pathname == baseLocation.pathname
                // if initial base page load
            && (   eventInfo.container == document.body
                // if the link refers to an element also in the loaded content
                || eventInfo.container.querySelector(selectorFromHash(link.hash)) != null
               // if the link refers to the loaded content container itself
                || (   eventInfo.container instanceof Element
                    && eventInfo.container.matches(selectorFromHash(link.hash))))) {
            link.swapClasses([ "link-self", "link-page" ], 0);
        } else if (link.pathname.slice(1).match(/[\.]/) == null) {
            link.swapClasses([ "link-self", "link-page" ], 1);
        }
    });
}, "rewrite");

/************************************************************************/
/*  Assign proper link icons to self-links (directional or otherwise) and
    local links.
 */
addContentInjectHandler(GW.contentInjectHandlers.designateSpecialLinkIcons = (eventInfo) => {
    GWLog("designateSpecialLinkIcons", "rewrite.js", 1);

    //  Self-links (anchorlinks to the current page).
    eventInfo.container.querySelectorAll(".link-self:not(.icon-not)").forEach(link => {
        link.dataset.linkIconType = "text";
        link.dataset.linkIcon = "\u{00B6}"; // ¶

        /*  Directional navigation links on self-links: for each self-link like
            “see [later](#later-identifier)”, find the linked identifier,
            whether it’s before or after, and if it is before/previously,
            annotate the self-link with ‘↑’ and if after/later, ‘↓’. This helps
            the reader know if it’s a backwards link to an identifier already
            read, or an unread identifier.
         */
        let target = eventInfo.container.querySelector(selectorFromHash(link.hash));
        if (!target)
            return;

        link.dataset.linkIconType = "svg";
        link.dataset.linkIcon =
            (link.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
             ? "arrow-down"
             : "arrow-up");
    });

    //  Local links (to other pages on the site).
    eventInfo.container.querySelectorAll(".link-page:not(.icon-not)").forEach(link => {
        if (link.dataset.linkIcon)
            return;

        link.dataset.linkIconType = "text";
        link.dataset.linkIcon = "\u{1D50A}"; // 𝔊
    });
}, "rewrite");

/*****************************************/
/*  Removes link icons that should not be.
 */
addContentInjectHandler(GW.contentInjectHandlers.cleanSpuriousLinkIcons = (eventInfo) => {
    GWLog("cleanSpuriousLinkIcons", "rewrite.js", 1);

    let excludedLinkSelector = [
        /*  Index page, and embeds thereof, do not need the G icon.

            NOTE: we do not use the usual method of suppressing G icons
            (`.icon-not` class), because /index and /static/404 are *so* long
            and routinely modified/expanded, so doing it ‘manually’ would risk
            occasional omissions or syntax errors.
         */
        "body.page-index",
        "body.page-static-404",
        ".popframe-body.page-index",
        ".popframe-body.page-static-404",

        /*  TOC links should never have link icons under any circumstances.
         */
        ".TOC"
    ].map(x => x + " a[data-link-icon]").join(", ");

    eventInfo.container.querySelectorAll(excludedLinkSelector).forEach(link => {
        link.removeAttribute("data-link-icon-type");
        link.removeAttribute("data-link-icon");
    });
}, "rewrite");

/****************************************************************************/
/*  Adds HTML and CSS to a link, enabling display of its specified link icon.
 */
function enableLinkIcon(link) {
    if (link.classList.contains("has-icon"))
        return;

    //  Add hook.
    link.appendChild(newElement("SPAN", { class: "link-icon-hook" }, { innerHTML: "\u{2060}" }));

    //  Set CSS variable.
    if (link.dataset.linkIconType.includes("text")) {
        link.style.setProperty("--link-icon", `"${(link.dataset.linkIcon)}"`);
    } else if (link.dataset.linkIconType.includes("svg")) {
		let iconFileURL = versionedAssetURL("/static/img/icon/icons.svg");
        link.style.setProperty("--link-icon-url",
            `url("${iconFileURL.pathname}${iconFileURL.search}#${(link.dataset.linkIcon)}")`);
    }

    //  Set class.
    link.classList.add("has-icon");
}

/****************************************************************************/
/*  Disable display of a link’s link icon by removing requisite HTML and CSS.
 */
function disableLinkIcon(link) {
    if (link.classList.contains("has-icon") == false)
        return;

    //  Remove hook.
    link.querySelector(".link-icon-hook").remove();

    //  Clear CSS variables.
    link.style.removeProperty("--link-icon");
    link.style.removeProperty("--link-icon-url");

    //  Unset class.
    link.classList.remove("has-icon");
}

/*************************************************************************/
/*  Enable or disable display of link icons, as appropriate for each link.
 */
addContentInjectHandler(GW.contentInjectHandlers.setLinkIconStates = (eventInfo) => {
    GWLog("setLinkIconStates", "rewrite.js", 1);

    /*  Enable display of link icons for all links that have specified icons.
     */
    eventInfo.container.querySelectorAll("a[data-link-icon]").forEach(link => {
        enableLinkIcon(link);
    });

    /*  Disable display of link icons for links that have had it enabled, but
        actually should not display icons (which may happen if, e.g.,
        a .link-page becomes a .link-self due to transclusion / pop-frame
        embedding, and has no anchor).
     */
    let iconlessLinkSelector = [
        "a:not([data-link-icon])",
        "a[data-link-icon='']"
    ].map(x => x + ".has-icon").join(", ");
    eventInfo.container.querySelectorAll(iconlessLinkSelector).forEach(link => {
        disableLinkIcon(link);
    });
}, "rewrite");


/*********/
/* MISC. */
/*********/

GW.currencyFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2
});
GW.currentYear = new Date().getFullYear();

/*************************************************************************/
/*	Return prettified version of a string representing an amount of money.
 */
function prettifyCurrencyString(amount, compact = false, forceRound = false) {
	let currency = amount[0];

	let number = Number(amount.replace(/[^0-9.−-]+/g, ""));
	if (   number >= 100
		|| forceRound)
		number = Math.round(number);

	amount = GW.currencyFormatter.format(number);

	//	Remove trailing zeroes.
	amount = amount.replace(/\.00?$/, '');

	//	Reset currency unit.
	amount = currency + amount.slice(1);

	if (compact) {
		amount = amount.replace(/,000,000,000$/, 'b');
		amount = amount.replace(/,000,000$/, 'm');
		amount = amount.replace(/,000$/, 'k');
	}

	return amount;
}

/**************************************************************************/
/*	Rewrite inflation-adjustment elements to make the currency amounts more
	useful and readable.
 */
addContentLoadHandler(GW.contentLoadHandlers.rewriteInflationAdjusters = (eventInfo) => {
    GWLog("rewriteInflationAdjusters", "rewrite.js", 1);

	eventInfo.container.querySelectorAll(".inflation-adjusted").forEach(infAdj => {
		let unadjusted = infAdj.querySelector("sup");
		let adjusted = infAdj.firstChild;

		unadjusted.textContent = prettifyCurrencyString(unadjusted.textContent, true);

		/*	Always round adjusted amount if unadjusted amount has no fractional
			component and adjusted amount has more than one whole digit.
		 */
		let forceRound = (   unadjusted.textContent.includes(".") == false
						  && adjusted.textContent.match(/([0-9]+)(\.|$)/)[1].length > 1);
		adjusted.textContent = prettifyCurrencyString(adjusted.textContent, false, forceRound);
	});
}, "rewrite");

/***************************************************************************/
/*  Makes it so that copying an inflation-adjusted currency amount interacts 
	properly with copy-paste.
 */
addCopyProcessor((event, selection) => {
    /*  Rewrite inflation-adjuster elements into a simple inline typographical 
    	format, e.g. “$0.10 (1990; $1.30 in 2023)”.
     */
    selection.querySelectorAll(".inflation-adjusted").forEach(infAdj => {
		let adjustedText = infAdj.firstChild.textContent;
		let unadjustedText = infAdj.querySelector("sup").textContent;
		let yearText = infAdj.querySelector("sub").textContent;

		//	Un-abbreviate powers of 1,000 in unadjusted amount.
		unadjustedText = unadjustedText.replace("k", ",000");
		unadjustedText = unadjustedText.replace("m", ",000,000");
		unadjustedText = unadjustedText.replace("b", ",000,000,000");

        infAdj.innerHTML = `${unadjustedText} [${yearText}; ${adjustedText} in ${GW.currentYear}]`;
    });

    return true;
});

/******************************************************************************/
/*  Makes double-clicking on an inflation adjuster select the entire element.
	(This is so that the copy processor, above, can reliably work as intended.)
 */
addContentInjectHandler(GW.contentInjectHandlers.addDoubleClickListenersToInflationAdjusters = (eventInfo) => {
    GWLog("addDoubleClickListenersToInflationAdjusters", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".inflation-adjusted").forEach(infAdj => {
        infAdj.addEventListener("dblclick", (event) => {
            document.getSelection().selectNode(infAdj);
        });
    });
}, "eventListeners");

/***************************************************************************/
/*  Clean up image alt-text. (Shouldn’t matter, because all image URLs work,
    right? Yeah, right...)
 */
addContentLoadHandler(GW.contentLoadHandlers.cleanUpImageAltText = (eventInfo) => {
    GWLog("cleanUpImageAltText", "rewrite.js", 1);

    /*  If an image has no alt text, use the value of the ‘title’ attribute,
        if present; otherwise, a default string (“Image”).
     */
    eventInfo.container.querySelectorAll("img:not([alt])").forEach(image => {
        image.alt = (image.title || "Image");
    });

    //  URL-encode ‘%’ signs in image alt text.
    eventInfo.container.querySelectorAll("img[alt]").forEach(image => {
        image.alt = decodeURIComponent(image.alt.replace(/%(?![A-Fa-f0-9]{2})/g, "%25"));
    });
}, "rewrite");

/************************************************************************/
/*  Prevent line breaks immediately before citations (which “orphans” the
    citation on the next line, and looks ugly) and immediately after citations
    (which causes punctuation following a citation to be orphaned, and also
    looks ugly).
 */
addContentLoadHandler(GW.contentLoadHandlers.noBreakForCitations = (eventInfo) => {
    GWLog("noBreakForCitations", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".footnote-ref").forEach(citation => {
    	citation.parentElement.insertBefore(document.createTextNode("\u{2060}"), citation);
        let textNode = citation.querySelector("sup").firstTextNode;
        textNode.textContent = "\u{2060}" + textNode.textContent + "\u{2060}";
    });
}, "rewrite");

/****************************************************************************/
/*	Designate containers wherein colors (e.g. link colors) should be inverted
	(because the container has a dark background).
 */
addContentLoadHandler(GW.contentLoadHandlers.designatedColorInvertedContainers = (eventInfo) => {
    GWLog("designatedColorInvertedContainers", "rewrite.js", 1);

	let selector = [
		".admonition.warning",
		".admonition.error"
	].join(", ");

	eventInfo.container.querySelectorAll(selector).forEach(container => {
		container.classList.add("colors-invert");
	});
}, "rewrite");

/******************************************************************/
/*	Wrap text nodes and inline elements in admonitions in <p> tags.
 */
addContentLoadHandler(GW.contentLoadHandlers.paragraphizeAdmonitionTextNodes = (eventInfo) => {
    GWLog("paragraphizeAdmonitionTextNodes", "rewrite.js", 1);

	eventInfo.container.querySelectorAll(selectorize([ ".admonition", ".admonition-title" ])).forEach(paragraphizeTextNodesOfElement);
}, "rewrite");

/*********************************************/
/*	Fix incorrect text block tag types.

	- .text-center are <div> but should be <p>
 */
addContentLoadHandler(GW.contentLoadHandlers.rectifySpecialTextBlockTagTypes = (eventInfo) => {
    GWLog("rectifySpecialTextBlockTagTypes", "rewrite.js", 1);

	eventInfo.container.querySelectorAll(".text-center").forEach(div => {
		rewrapContents(div, null, "P", true, true);
	});
}, "rewrite");

/*******************************************************/
/*	Designate ordinal superscripts (1st, 2nd, 3rd, nth).
 */
addContentLoadHandler(GW.contentLoadHandlers.designateOrdinals = (eventInfo) => {
    GWLog("designateOrdinals", "rewrite.js", 1);

	eventInfo.container.querySelectorAll("sup").forEach(sup => {
		if ([ "st", "nd", "rd", "th" ].includes(sup.textContent.toLowerCase()))
			sup.classList.add("ordinal");
	});
}, "rewrite");


/*************/
/* DROP CAPS */
/*************/

/***************************************************/
/*	Drop-caps (only on sufficiently wide viewports).
 */
addContentInjectHandler(GW.contentInjectHandlers.rewriteDropCaps = (eventInfo) => {
    GWLog("rewriteDropCaps", "rewrite.js", 1);

	//	Reset drop-caps when margin note mode changes.
	doWhenMatchMedia(Sidenotes.mediaQueries.viewportWidthBreakpoint, "GW.dropCaps.resetDropCapsWhenMarginNoteModeChanges", (mediaQuery) => {
		eventInfo.container.querySelectorAll(GW.dropCaps.dropCapBlockSelector).forEach(resetDropCapInBlock);
	});

	//	A capital letter, optionally preceded by an opening quotation mark.
	let initialRegexp = new RegExp(/^(\s*[“‘]?)?([A-Z])/);

	processContainerNowAndAfterBlockLayout(eventInfo.container, (container) => {
		container.querySelectorAll(GW.dropCaps.dropCapBlockSelector).forEach(dropCapBlock => {
			//	If this drop-cap has already been processed, do nothing.
			if (dropCapBlock.querySelector(".drop-cap"))
				return;

			//	Make sure the graf begins properly and determine initial letter.
			let initial = initialRegexp.exec(textContentOfGraf(dropCapBlock));
			if (initial == null) {
				addDropCapClassTo(dropCapBlock, "not");
				return;
			}
			let [ fullInitial, precedingPunctuation, initialLetter ] = initial;

			//	Locate insertion point.
			let firstNode = firstTextNodeOfGraf(dropCapBlock);
			let firstNodeParent = firstNode.parentElement;

			//	Separate first letter from rest of text content.
			firstNode.textContent = firstNode.textContent.slice(fullInitial.length);

			//	Determine drop-cap type.
			let dropCapType = dropCapTypeOf(dropCapBlock);

			//	Is this is a graphical drop-cap?
			if (GW.dropCaps.graphicalDropCapTypes.includes(dropCapType)) {
				//	Designate as graphical drop-cap.
				dropCapBlock.classList.add("graphical-drop-cap");

				//	Inject a hidden span to hold the first letter as text.
				firstNodeParent.insertBefore(newElement("SPAN", {
					class: "hidden-initial-letter",
				}, {
					innerHTML: initialLetter
				}), firstNode);

				//	Select a drop-cap.
				let dropCapURL = randomDropCapURL(dropCapType, initialLetter);

				//	Inject the drop-cap image element.
				firstNodeParent.insertBefore(newElement("IMG", {
					class: "drop-cap figure-not",
					src: dropCapURL.pathname + dropCapURL.search
				}), firstNode.previousSibling);
			} else {
				//	Inject the drop-cap.
				firstNodeParent.insertBefore(newElement("SPAN", {
					class: "drop-cap"
				}, {
					innerHTML: initialLetter
				}), firstNode);
			}

			//	If there’s punctuation before the initial letter, inject it.
			if (precedingPunctuation) {
				firstNodeParent.insertBefore(newElement("SPAN", {
					class: "initial-preceding-punctuation"
				}, {
					innerHTML: precedingPunctuation
				}), firstNodeParent.querySelector(".drop-cap"));
			}
		});
	});
}, "rewrite", (info) => (   info.document == document
						 && GW.mediaQueries.mobileWidth.matches == false
						 && GW.isMobile() == false));

/***********************************************************/
/*	Activate mode-based dynamic graphical drop-cap swapping.
 */
addContentInjectHandler(GW.contentInjectHandlers.activateDynamicGraphicalDropCaps = (eventInfo) => {
    GWLog("activateDynamicGraphicalDropCaps", "rewrite.js", 1);

	processContainerNowAndAfterBlockLayout(eventInfo.container, (container) => {
		container.querySelectorAll(GW.dropCaps.dropCapBlockSelector).forEach(dropCapBlock => {
			//	Determine drop-cap type.
			let dropCapType = dropCapTypeOf(dropCapBlock);

			//	Is this a recognized graphical drop-cap type?
			if (GW.dropCaps.graphicalDropCapTypes.includes(dropCapType) == false)
				return;

			//	Get the drop-cap image element.
			let dropCapImage = dropCapBlock.querySelector("img.drop-cap");
			if (dropCapImage == null)
				return;

			//	If the handler already exists, do nothing.
			if (dropCapImage.modeChangeHandler)
				return;

			//	Get the initial letter.
			let initialLetter = dropCapBlock.querySelector(".hidden-initial-letter")?.textContent;
			if (initialLetter == null)
				return;

			//	Add event handler to switch image when mode changes.
			GW.notificationCenter.addHandlerForEvent(dropCapImage.modeChangeHandler = "DarkMode.computedModeDidChange", (info) => {
				let dropCapUrl = randomDropCapURL(dropCapType, initialLetter);
				dropCapImage.src = dropCapUrl.pathname + dropCapUrl.search;
			});
		});
	});
}, "eventListeners", (info) => (   info.document == document
								&& GW.mediaQueries.mobileWidth.matches == false
								&& GW.isMobile() == false));

/*********************/
/*	Linkify drop-caps.
 */
addContentInjectHandler(GW.contentInjectHandlers.linkifyDropCaps = (eventInfo) => {
    GWLog("linkifyDropCaps", "rewrite.js", 1);

	processContainerNowAndAfterBlockLayout(eventInfo.container, (container) => {
		container.querySelectorAll(GW.dropCaps.dropCapBlockSelector).forEach(dropCapBlock => {
			//	If this drop-cap has already been linkified, do nothing.
			if (dropCapBlock.querySelector(".link-drop-cap"))
				return;

			//	Determine drop-cap type.
			let dropCapType = dropCapTypeOf(dropCapBlock);

			//	Determine initial letter.
			let initialLetter = (   dropCapBlock.querySelector("span.drop-cap")
								 ?? dropCapBlock.querySelector(".hidden-initial-letter")).textContent;

			//	Get the drop-cap (textual or graphical).
			let dropCap = dropCapBlock.querySelector(".drop-cap");

			//	Wrap the drop-cap (textual or graphical) in a link.
			let dropCapLink = newElement("A", {
				class: "link-page link-drop-cap",
				href: "/dropcap#" + dropCapType,
				"data-letter": initialLetter,
				"data-drop-cap-type": dropCapType
			});
			let dropCapLinkWrapper = newElement("SPAN");
			dropCapLinkWrapper.append(dropCapLink);
			dropCapLink.append(dropCap);

			//	Locate insertion point.
			let firstNode = firstTextNodeOfGraf(dropCapBlock);
			let firstNodeParent = firstNode.parentElement;
			if (firstNodeParent.matches(".initial-preceding-punctuation")) {
				firstNode = firstNodeParent.nextSibling;
				firstNodeParent = firstNodeParent.parentElement;
			} else if (firstNodeParent.matches(".hidden-initial-letter")) {
				firstNode = firstNodeParent;
				firstNodeParent = firstNodeParent.parentElement;
			}

			//	Inject the link-wrapped drop-cap back into the block.
			firstNodeParent.insertBefore(dropCapLinkWrapper, firstNode);

			//	Process the link to enable extract pop-frames.
			Extracts.addTargetsWithin(dropCapLinkWrapper);

			//	Unwrap temporary wrapper.
			unwrap(dropCapLinkWrapper);
		});
	});
}, "rewrite", (info) => (   info.document == document
						 && GW.mediaQueries.mobileWidth.matches == false
						 && GW.isMobile() == false));

/***********************************************************************/
/*	Prevent blocks with drop caps from overlapping the block below them.
 */
addContentInjectHandler(GW.contentInjectHandlers.preventDropCapsOverlap = (eventInfo) => {
    GWLog("preventDropCapsOverlap", "rewrite.js", 1);

	let blocksNotToBeOverlappedSelector = [
		"section",
		"blockquote",
		".list",
		".collapse",
		".list-heading",
		"p[class*='drop-cap-']"
	].join(", ");

	processContainerNowAndAfterBlockLayout(eventInfo.container, (container) => {
		container.querySelectorAll("p[class*='drop-cap-']").forEach(dropCapBlock => {
			let nextBlock = nextBlockOf(dropCapBlock, { alsoBlockElements: [ ".list" ] });
			if (   nextBlock == null
				|| nextBlock.matches(blocksNotToBeOverlappedSelector))
				dropCapBlock.classList.add("overlap-not");
		});
	});
}, ">rewrite", (info) => (   info.document == document
						  && GW.mediaQueries.mobileWidth.matches == false
						  && GW.isMobile() == false));


/********/
/* MATH */
/********/

/**************************************/
/*	Unwrap <p> wrappers of math blocks.
 */
addContentLoadHandler(GW.contentLoadHandlers.unwrapMathBlocks = (eventInfo) => {
    GWLog("unwrapMathBlocks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".mjpage__block").forEach(mathBlock => {
        mathBlock = mathBlock.closest(".math");
        mathBlock.classList.add("block");

		if (   mathBlock.parentElement?.matches("p")
			&& isOnlyChild(mathBlock))
			unwrap(mathBlock.parentElement);
	});
}, "rewrite");

/*****************************************************************************/
/*  Makes it so that copying a rendered equation or other math element copies
    the LaTeX source, instead of the useless gibberish that is the contents of
    the text nodes of the HTML representation of the equation.
 */
addCopyProcessor((event, selection) => {
    if (event.target.closest(".mjx-math")) {
        selection.replaceChildren(event.target.closest(".mjx-math").getAttribute("aria-label"));

        return false;
    }

    selection.querySelectorAll(".mjx-chtml").forEach(mathElement => {
        mathElement.innerHTML = " " + mathElement.querySelector(".mjx-math").getAttribute("aria-label") + " ";
    });

    return true;
});

/******************************************************************************/
/*  Makes double-clicking on a math element select the entire math element.
    (This actually makes no difference to the behavior of the copy listener
     [see the `addCopyProcessor` call above], which copies the entire LaTeX
     source of the full equation no matter how much of said equation is selected
     when the copy command is sent; however, it ensures that the UI communicates
     the actual behavior in a more accurate and understandable way.)
 */
addContentInjectHandler(GW.contentInjectHandlers.addDoubleClickListenersToMathBlocks = (eventInfo) => {
    GWLog("addDoubleClickListenersToMathBlocks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".mjpage").forEach(mathElement => {
        mathElement.addEventListener("dblclick", (event) => {
            document.getSelection().selectAllChildren(mathElement.querySelector(".mjx-chtml"));
        });
        mathElement.title = mathElement.classList.contains("mjpage__block")
        					? "Double-click to select equation, then copy, to get LaTeX source (or, just click the Copy button in the top-right of the equation area)"
        					: "Double-click to select equation; copy to get LaTeX source";
    });
}, "eventListeners");

/****************************************************************/
/*  Add block buttons (copy) to block (not inline) math elements.
 */
addContentLoadHandler(GW.contentLoadHandlers.addBlockButtonsToMathBlocks = (eventInfo) => {
    GWLog("addBlockButtonsToMathBlocks", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".math.block").forEach(mathBlock => {
        //  Inject button bar.
        mathBlock.appendChild(newElement("SPAN", { class: "block-button-bar" })).append(
        	newElement("BUTTON", {
				type: "button",
				class: "copy",
				tabindex: "-1",
				title: "Copy LaTeX source of this equation to clipboard"
			}, {
				innerHTML: GW.svg("copy-regular")
			}), 
			newElement("SPAN", {
				class: "scratchpad"
			})
		);
    });
}, "rewrite");

/************************************************/
/*  Activate copy buttons of math block elements.
 */
addContentInjectHandler(GW.contentInjectHandlers.activateMathBlockButtons = (eventInfo) => {
    GWLog("activateMathBlockButtons", "rewrite.js", 1);

    eventInfo.container.querySelectorAll(".math.block").forEach(mathBlock => {
        //  LaTeX source.
        let latexSource = mathBlock.querySelector(".mjx-math").getAttribute("aria-label");

        //  Copy button (copies LaTeX source).
        mathBlock.querySelector("button.copy").addActivateEvent((event) => {
            GWLog("mathBlockCopyButtonClicked", "rewrite.js", 3);

            copyTextToClipboard(latexSource);

            //  Flash math block, for visual feedback of copy operation.
            let innerMathBlock = mathBlock.querySelector(".MJXc-display");
            innerMathBlock.classList.add("flash");
            setTimeout(() => { innerMathBlock.classList.remove("flash"); }, 150);
        });
    });
}, "eventListeners");


/**********************************/
/* BROKEN HTML STRUCTURE CHECKING */
/**********************************/

/*  Check for #footnotes outside of #markdownBody, which indicates a prematurely
    closed div#markdownBody (probably due to some error in the page source).
 */
doWhenPageLoaded(() => {
    let footnotesSection = document.querySelector("#footnotes");
    if (   footnotesSection
        && footnotesSection.closest("#markdownBody") == null)
        GWServerLogError(location.href + "--broken-html-structure");
});


/**************************/
/* BROKEN ANCHOR CHECKING */
/**************************/
/*  If a reader loads a page and the anchor ID/hash does not exist inside the page,
    fire off a request to the 404 page, whose logs are reviewed manually,
    with the offending page+anchor ID, for correction (either fixing an outdated
    link somewhere on gwern.net, or adding a span/div manually to the page to
    make old inbound links go where they ought to).

    Such broken anchors can reflect out of date cross-page references, or reflect
    incoming URLs from elsewhere on the Internet which are broken/outdated.
    (Within-page anchor links are checked statically at compile-time, and those
     errors should never exist.)
 */

function reportBrokenAnchorLink(link) {
    GWLog("reportBrokenAnchorLink", "rewrite.js", 1);

    if (link.hash == "")
        return;

    GWServerLogError(fixedEncodeURIComponent(link.pathname) + "--" + fixedEncodeURIComponent(link.hash.substr(1)), "broken hash-anchor");
}

/*  Check for broken anchor (location hash not pointing to any element on the
    page) both at page load time and whenever the hash changes.
 */
GW.notificationCenter.addHandlerForEvent("GW.hashHandlingSetupDidComplete", GW.brokenAnchorCheck = (eventInfo) => {
    GWLog("GW.brokenAnchorCheck", "rewrite.js", 1);

    if (   location.hash > ""
        && /^#if_slide/.test(location.hash) == false
        && /^#:~:/.test(location.hash) == false
        && document.querySelector(selectorFromHash(location.hash)) == null)
        reportBrokenAnchorLink(location);
}, { once: true });
GW.notificationCenter.addHandlerForEvent("GW.hashDidChange", GW.brokenAnchorCheck);


/************/
/* PRINTING */
/************/

/*********************************************************************/
/*  Trigger transcludes and expand-lock collapse blocks when printing.
 */
window.addEventListener("beforeprint", GW.beforePrintHandler = (event) => {
    GWLog("Print command received.", "rewrite.js", 1);

    function expand(container) {
        Transclude.allIncludeLinksInContainer(container).forEach(includeLink => {
			if (includeLink.closest("#link-bibliography, .link-bibliography-append"))
				return;

            Transclude.transclude(includeLink, true);
        });

        container.querySelectorAll(".collapse").forEach(expandLockCollapseBlock);
    }

    GW.notificationCenter.addHandlerForEvent("GW.contentDidInject", GW.expandAllContentWhenLoadingPrintView = (eventInfo) => {
        expand(eventInfo.container);
    }, {
    	condition: (info) => (info.document == document)
    });

    expand(document);
});
window.addEventListener("afterprint", GW.afterPrintHandler = (event) => {
    GWLog("Print command completed.", "rewrite.js", 1);

    GW.notificationCenter.removeHandlerForEvent("GW.contentDidInject", GW.expandAllContentWhenLoadingPrintView);
});


/*****************************************************************************************/
/*! instant.page v5.1.0 - (C) 2019-2020 Alexandre Dieulot - https://instant.page/license */
/* Settings: 'prefetch' (loads HTML of target) after 1600ms hover (desktop) or mouse-down-click (mobile); TODO: left in logging for testing during experiment */
let pls="a:not(.has-content)";let t,e;const n=new Set,o=document.createElement("link"),z=o.relList&&o.relList.supports&&o.relList.supports("prefetch")&&window.IntersectionObserver&&"isIntersecting"in IntersectionObserverEntry.prototype,s="instantAllowQueryString"in document.body.dataset,a=true,r="instantWhitelist"in document.body.dataset,c="instantMousedownShortcut"in document.body.dataset,d=1111;let l=1600,u=!1,f=!1,m=!1;if("instantIntensity"in document.body.dataset){const t=document.body.dataset.instantIntensity;if("mousedown"==t.substr(0,"mousedown".length))u=!0,"mousedown-only"==t&&(f=!0);else if("viewport"==t.substr(0,"viewport".length))navigator.connection&&(navigator.connection.saveData||navigator.connection.effectiveType&&navigator.connection.effectiveType.includes("2g"))||("viewport"==t?document.documentElement.clientWidth*document.documentElement.clientHeight<45e4&&(m=!0):"viewport-all"==t&&(m=!0));else{const e=parseInt(t);isNaN(e)||(l=e)}}if(z){const n={capture:!0,passive:!0};if(f||document.addEventListener("touchstart",function(t){e=performance.now();const n=t.target.closest(pls);if(!h(n))return;v(n.href)},n),u?c||document.addEventListener("mousedown",function(t){const e=t.target.closest(pls);if(!h(e))return;v(e.href)},n):document.addEventListener("mouseover",function(n){if(performance.now()-e<d)return;const o=n.target.closest(pls);if(!h(o))return;o.addEventListener("mouseout",p,{passive:!0}),t=setTimeout(()=>{v(o.href),t=void 0},l)},n),c&&document.addEventListener("mousedown",function(t){if(performance.now()-e<d)return;const n=t.target.closest("a");if(t.which>1||t.metaKey||t.ctrlKey)return;if(!n)return;n.addEventListener("click",function(t){1337!=t.detail&&t.preventDefault()},{capture:!0,passive:!1,once:!0});const o=new MouseEvent("click",{view:window,bubbles:!0,cancelable:!1,detail:1337});n.dispatchEvent(o)},n),m){let t;(t=window.requestIdleCallback?t=>{requestIdleCallback(t,{timeout:1500})}:t=>{t()})(()=>{const t=new IntersectionObserver(e=>{e.forEach(e=>{if(e.isIntersecting){const n=e.target;t.unobserve(n),v(n.href)}})});document.querySelectorAll("a").forEach(e=>{h(e)&&t.observe(e)})})}}function p(e){e.relatedTarget&&e.target.closest("a")==e.relatedTarget.closest("a")||t&&(clearTimeout(t),t=void 0)}function h(t){if(t&&t.href&&(!r||"instant"in t.dataset)&&(a||t.origin==location.origin||"instant"in t.dataset)&&["http:","https:"].includes(t.protocol)&&("http:"!=t.protocol||"https:"!=location.protocol)&&(s||!t.search||"instant"in t.dataset)&&!(t.hash&&t.pathname+t.search==location.pathname+location.search||"noInstant"in t.dataset))return!0}function v(t){if(n.has(t))return;const e=document.createElement("link");console.log("Prefetched: "+t);e.rel="prefetch",e.href=t,document.head.appendChild(e),n.add(t)};
