/*	Popup/floating footnotes to avoid readers needing to scroll to the end of
	the page to see any footnotes; see
	http://ignorethecode.net/blog/2010/04/20/footnotes/ for details.

	Original author:  Lukas Mathis (2010-04-20)
	License: public domain ("And some people have asked me about a license for
	this piece of code. I think it’s far too short to get its own license, so
	I’m relinquishing any copyright claims. Consider the code to be public
	domain. No attribution is necessary.")
 */

Popups = {
	/**********/
	/*	Config.
	 */
    popupContainerID: "popup-container",
    popupContainerParentSelector: "html",
    popupContainerZIndex: "10000",

    popupBreathingRoomX: 12.0,
    popupBreathingRoomY: 8.0,
    popupBreathingRoomYTight: -4.0,

    popupTriggerDelay: 750,
    popupFadeoutDelay: 100,
    popupFadeoutDuration: 250,

	/******************/
	/*	Implementation.
	 */

	//	Used in: Popups.containingDocumentForTarget
	rootDocument: document,

	popupFadeTimer: false,
	popupDespawnTimer: false,
	popupSpawnTimer: false,
	popupContainer: null,

	popupBeingDragged: null,

	hoverEventsActive: true,

	cleanup: () => {
		GWLog("Popups.cleanup", "popups.js", 1);

        //  Remove popups container.
        document.querySelectorAll(`#${Popups.popupContainerID}`).forEach(element => element.remove());
		Popups.popupContainer = null;

		//  Remove Escape key event listener.
		document.removeEventListener("keyup", Popups.keyUp);

		//	Remove scroll listener.
		removeScrollListener("updatePopupsEventStateScrollListener");
		//	Remove popup-spawn event handler.
		GW.notificationCenter.removeHandlerForEvent("Popups.popupDidSpawn", Popups.addDisableHoverEventsOnScrollListenerOnPopupSpawned);
		//	Remove mousemove listener.
		window.removeEventListener("mousemove", Popups.windowMouseMove);
	},

	setup: () => {
		GWLog("Popups.setup", "popups.js", 1);

        //  Run cleanup.
        Popups.cleanup();

        //  Inject popups container.
        let popupContainerParent = document.querySelector(Popups.popupContainerParentSelector);
        if (popupContainerParent == null) {
            GWLog("Popup container parent element not found. Exiting.", "popups.js", 1);
            return;
        }
        Popups.popupContainer = popupContainerParent.appendChild(newElement("DIV", {
        	id: Popups.popupContainerID,
        	class: "popup-container",
        	style: `z-index: ${Popups.popupContainerZIndex};`
        }));

		//	Add window resize listener, to reposition pinned popups.
		addWindowResizeListener(Popups.repositionPopupsOnWindowResize = (event) => {
			Popups.allSpawnedPopups().forEach(popup => {
				Popups.setPopupViewportRect(popup, popup.viewportRect, { clampPositionToScreen: true });
			});
		}, "repositionPopupsOnWindowResizeListener", { defer: true });

		//  Add Escape key event listener.
		document.addEventListener("keyup", Popups.keyUp);

		//	Add scroll listener, to disable hover on scroll.
		addScrollListener(Popups.disableHoverEventsOnScroll = (event) => {
			Popups.hoverEventsActive = false;
		}, "disablePopupHoverEventsOnScrollListener");
		/*	Add event handler to add scroll listener to spawned popups, to
			disable hover events when scrolling within a popup.
		 */
		GW.notificationCenter.addHandlerForEvent("Popups.popupDidSpawn", Popups.addDisableHoverEventsOnScrollListenerOnPopupSpawned = (info) => {
			addScrollListener(Popups.disableHoverEventsOnScroll, null, null, info.popup.scrollView);
		});
		//	Add mousemove listener, to enable hover on mouse move.
		window.addEventListener("mousemove", Popups.windowMouseMove = (event) => {
			Popups.hoverEventsActive = true;
		});

		GW.notificationCenter.fireEvent("Popups.setupDidComplete");
	},

	//	Called by: extracts.js
	addTargetsWithin: (contentContainer, targets, prepareFunction, targetPrepareFunction, targetRestoreFunction) => {
		GWLog("Popups.addTargetsWithin", "popups.js", 1);

		if (typeof contentContainer == "string")
			contentContainer = document.querySelector(contentContainer);

		if (contentContainer == null)
			return;

		//	Get all targets.
		contentContainer.querySelectorAll(targets.targetElementsSelector).forEach(target => {
			if (   target.matches(targets.excludedElementsSelector)
				|| target.closest(targets.excludedContainerElementsSelector) != null) {
				target.classList.toggle("no-popup", true);
				return;
			}

			//  Apply the test function to the target.
			if (targets.testTarget(target) == false) {
				target.classList.toggle("no-popup", true);
				targetRestoreFunction(target);
				return;
			}

			//	Bind mouseenter/mouseleave/mousedown events.
			target.addEventListener("mouseenter", Popups.targetMouseEnter);
			target.addEventListener("mouseleave", Popups.targetMouseLeave);
			target.addEventListener("mousedown", Popups.targetMouseDown);

			//  Set prepare function.
			target.preparePopup = prepareFunction;

			//	Set target restore function.
			target.restoreTarget = targetRestoreFunction;

			//  Run any custom processing.
			if (targetPrepareFunction)
				targetPrepareFunction(target);

			//  Mark target as spawning a popup.
			target.classList.toggle("spawns-popup", true);
		});
	},

	//	Called by: extracts.js
	removeTargetsWithin: (contentContainer, targets, targetRestoreFunction = null) => {
		GWLog("Popups.removeTargetsWithin", "popups.js", 1);

		if (typeof contentContainer == "string")
			contentContainer = document.querySelector(contentContainer);

		if (contentContainer == null)
			return;

		contentContainer.querySelectorAll(targets.targetElementsSelector).forEach(target => {
			if (   target.matches(targets.excludedElementsSelector)
				|| target.closest(targets.excludedContainerElementsSelector) != null) {
				target.classList.toggle("no-popup", false);
				return;
			}

			//  Apply the test function to the target.
			if (targets.testTarget(target) == false) {
				target.classList.toggle("no-popup", false);
				return;
			}

			//	Unbind existing mouseenter/mouseleave/mousedown events, if any.
			target.removeEventListener("mouseenter", Popups.targetMouseEnter);
			target.removeEventListener("mouseleave", Popups.targetMouseLeave);
			target.removeEventListener("mousedown", Popups.targetMouseDown);

			//  Clear timers for target.
			Popups.clearPopupTimers(target);

			//  Remove spawned popup for target, if any.
			if (target.popup)
				Popups.despawnPopup(target.popup);

			//  Unset popup prepare function.
			target.preparePopup = null;

			//  Un-mark target as spawning a popup.
			target.classList.toggle("spawns-popup", false);

			//  Run any custom processing.
			targetRestoreFunction = targetRestoreFunction ?? target.restoreTarget;
			if (targetRestoreFunction)
				targetRestoreFunction(target);
		});
	},

	/*******************/
	/*  General helpers.
	 */

	popupContainerIsVisible: () => {
		return (Popups.popupContainer.style.visibility != "hidden");
	},

	//	Called by: extracts-options.js
	hidePopupContainer: () => {
		GWLog("Popups.hidePopupContainer", "popups.js", 3);

		if (Popups.popupContainer) {
			Popups.popupContainer.style.visibility = "hidden";
			Popups.allSpawnedPopups().forEach(popup => {
				Popups.addClassesToPopFrame(popup, "hidden");
			});
		} else {
			GW.notificationCenter.addHandlerForEvent("Popups.setDidComplete", (info) => {
				Popups.hidePopupContainer();
			});
		}
	},

	//	Called by: extracts-options.js
	unhidePopupContainer: () => {
		GWLog("Popups.unhidePopupContainer", "popups.js", 3);

		if (Popups.popupContainer) {
			Popups.popupContainer.style.visibility = "";
			Popups.allSpawnedPopups().forEach(popup => {
				Popups.removeClassesFromPopFrame(popup, "hidden");
			});
		} else {
			GW.notificationCenter.addHandlerForEvent("Popups.setDidComplete", (info) => {
				Popups.unhidePopupContainer();
			});
		}
	},

	updatePageScrollState: () => {
		GWLog("Popups.updatePageScrollState", "popups.js", 2);

		if (Popups.allSpawnedPopups().findIndex(popup => Popups.popupIsMaximized(popup)) == -1)
			togglePageScrolling(true);
		else
			togglePageScrolling(false);
	},

	containingDocumentForTarget: (target) => {
		let containingPopup = Popups.containingPopFrame(target);
		return (containingPopup ? containingPopup.document : Popups.rootDocument);
	},

	allSpawnedPopFrames: () => {
		return Popups.allSpawnedPopups();
	},

	//	Called by: extracts.js
	allSpawnedPopups: () => {
		if (Popups.popupContainer == null)
			return [ ];

		return Array.from(Popups.popupContainer.children).filter(popup => (popup.classList.contains("fading") == false));
	},

	//	Called by: extracts.js
	containingPopFrame: (element) => {
		let shadowBody = element.closest(".shadow-body");
		if (shadowBody)
			return shadowBody.popup;

		return element.closest(".popup");
	},

	addClassesToPopFrame: (popup, ...args) => {
		popup.classList.add(...args);
		popup.body.classList.add(...args);
	},

	removeClassesFromPopFrame: (popup, ...args) => {
		popup.classList.remove(...args);
		popup.body.classList.remove(...args);
	},

	/****************************************/
	/*  Visibility of elements within popups.
	 */

	/*	Returns true if the given element is currently visible.
	 */
	//	Called by: extracts-content.js
	isVisible: (element) => {
		let containingPopup = Popups.containingPopFrame(element);
		return (containingPopup ? isWithinRect(element, containingPopup.getBoundingClientRect()) : isOnScreen(element));
	},

	//	Called by: extracts.js
	scrollElementIntoViewInPopFrame: (element, alwaysRevealTopEdge = false) => {
		let popup = Popups.containingPopFrame(element);

		let elementRect = element.getBoundingClientRect();
		let popupBodyRect = popup.body.getBoundingClientRect();
		let popupScrollViewRect = popup.scrollView.getBoundingClientRect();

		let bottomBound = alwaysRevealTopEdge ? elementRect.top : elementRect.bottom;
		if (   popup.scrollView.scrollTop                              >= elementRect.top    - popupBodyRect.top
			&& popup.scrollView.scrollTop + popupScrollViewRect.height <= bottomBound - popupBodyRect.top)
			return;

		popup.scrollView.scrollTop = elementRect.top - popupBodyRect.top;
	},

	/*******************************/
	/*  Popup spawning & despawning.
	 */

	newPopup: (target) => {
		GWLog("Popups.newPopup", "popups.js", 2);

		let popup = newElement("DIV");
		popup.classList.add("popup", "popframe");
		popup.innerHTML = `<div class="popframe-scroll-view"><div class="popframe-content-view"></div></div>`;
		popup.scrollView = popup.querySelector(".popframe-scroll-view");
		popup.contentView = popup.querySelector(".popframe-content-view");

		popup.contentView.attachShadow({ mode: "open" });
		popup.document = popup.contentView.shadowRoot;
		popup.document.appendChild(newElement("DIV"));
		popup.document.body = popup.body = popup.shadowBody = popup.document.firstElementChild;
		popup.body.classList.add("popframe-body", "popup-body", "shadow-body");

		let styleReset = newElement("STYLE");
		styleReset.innerHTML = `.shadow-body { all: initial; }`;
		popup.document.insertBefore(styleReset, popup.body);

		popup.document.popup = popup;

		popup.body.popup = popup.contentView.popup = popup.scrollView.popup = popup;

		popup.titleBarContents = [ ];

		popup.uiElementsContainer = popup.appendChild(newElement("DIV", { "class": "popframe-ui-elements-container" }));

		//  Give the popup a reference to the target.
		popup.spawningTarget = target;

		return popup;
	},

	//	Called by: extracts.js
	//	Called by: extracts-content.js
	setPopFrameContent: (popup, content) => {
		if (content) {
			popup.body.replaceChildren(content);

			return true;
		} else {
			return false;
		}
	},

	//	Called by: extracts.js
	//	Called by: extracts-annotations.js
	spawnPopup: (target, spawnPoint) => {
		GWLog("Popups.spawnPopup", "popups.js", 2);

		//  Prevent spawn attempts before setup complete.
		if (Popups.popupContainer == null)
			return;

		//	Set wait cursor.
		Popups.setWaitCursorForTarget(target);

		//  Despawn existing popup, if any.
		if (target.popup)
			Popups.despawnPopup(target.popup);

		/*	Once this popup is spawned, despawn all non-pinned popups not in this
			popup’s stack.
		 */
		GW.notificationCenter.addHandlerForEvent("Popups.popupDidSpawn", (info) => {
			Popups.allSpawnedPopups().forEach(spawnedPopup => {
				if (   Popups.popupIsPinned(spawnedPopup) == false
					&& target.popup.popupStack.indexOf(spawnedPopup) == -1)
					Popups.despawnPopup(spawnedPopup);
			});
		}, {
			once: true,
			condition: (info) => (info.popup == target.popup)
		});

		//  Create the new popup.
		target.popFrame = target.popup = Popups.newPopup(target);

		//  Prepare the newly created popup for spawning.
		if ((target.popFrame = target.popup = target.preparePopup(target.popup)) == null) {
			//	Reset cursor to normal.
			Popups.clearWaitCursorForTarget(target);

			return;
		}

		//  If title bar contents are provided, add a title bar (if needed).
		if (   target.popup.titleBar == null
			&& target.popup.titleBarContents.length > 0)
			Popups.addTitleBarToPopup(target.popup);

		if (target.popup.parentElement == Popups.popupContainer) {
			//  If the popup is an existing popup, just bring it to the front.
			Popups.bringPopupToFront(target.popup);
		} else {
			//	Otherwise, inject the popup into the page.
			Popups.injectPopup(target.popup);
		}

		//  Position the popup appropriately with respect to the target.
		Popups.positionPopup(target.popup, spawnPoint);

		//  Mark target as having an active popup associated with it.
		target.classList.add("popup-open");

		//  Fire notification event.
		GW.notificationCenter.fireEvent("Popups.popupDidSpawn", { popup: target.popup });

		requestAnimationFrame(() => {
			//	Disable rendering progress indicator (spinner).
			if (target.popup)
				Popups.removeClassesFromPopFrame(target.popup, "rendering");

			//	Reset cursor to normal.
			Popups.clearWaitCursorForTarget(target);
		});
	},

	injectPopup: (popup) => {
		GWLog("Popups.injectPopup", "popups.js", 2);

		//  Add popup to a popup stack.
		if (popup.popupStack == null) {
			let parentPopup = Popups.containingPopFrame(popup.spawningTarget);
			popup.popupStack = parentPopup ? parentPopup.popupStack : [ ];
		} else {
			popup.popupStack.remove(popup);
		}
		popup.popupStack.push(popup);

		//	Set rendering progress indicator (spinner).
		Popups.addClassesToPopFrame(popup, "rendering");

		//  Inject popup into page.
		Popups.popupContainer.appendChild(popup);

		//  Bring popup to front.
		Popups.bringPopupToFront(popup);

		//  Cache border width.
		popup.borderWidth = parseFloat(getComputedStyle(popup).borderLeftWidth);

		//	Add event listeners.
		popup.addEventListener("click", Popups.popupClicked);
		popup.addEventListener("mouseenter", Popups.popupMouseEnter);
		popup.addEventListener("mouseleave", Popups.popupMouseLeave);
		popup.addEventListener("mouseout", Popups.popupMouseOut);
		popup.addEventListener("mousedown", Popups.popupMouseDown);

		//  We define the mousemove listener here in order to capture `popup`.
		popup.addEventListener("mousemove", Popups.popupMouseMove = (event) => {
			GWLog("Popups.popupMouseMove", "popups.js", 3);

			if (   event.target == popup
				&& Popups.popupBeingDragged == null
				&& Popups.popupIsResizeable(popup)) {
				//  Mouse position is relative to the popup’s coordinate system.
				let edgeOrCorner = Popups.edgeOrCorner(popup, {
					x: event.clientX - popup.viewportRect.left,
					y: event.clientY - popup.viewportRect.top
				});

				//  Set cursor.
				document.documentElement.style.cursor = Popups.cursorForPopupBorder(edgeOrCorner);
			}
		});
	},

	attachPopupToTarget: (popup) => {
		GWLog("Popups.attachPopupToTarget", "popups.js", 2);

		Popups.clearPopupTimers(popup.spawningTarget);

        popup.spawningTarget.classList.add("popup-open");
        popup.spawningTarget.popup = popup;
        popup.spawningTarget.popFrame = popup;
	},

	//	Called by: extracts.js
	detachPopupFromTarget: (popup) => {
		GWLog("Popups.detachPopupFromTarget", "popups.js", 2);

		Popups.clearPopupTimers(popup.spawningTarget);

        popup.spawningTarget.classList.remove("popup-open");
        popup.spawningTarget.popup = null;
        popup.spawningTarget.popFrame = null;
	},

    despawnPopup: (popup) => {
		GWLog("Popups.despawnPopup", "popups.js", 2);

		if (popup.isDespawned)
			return;

		GW.notificationCenter.fireEvent("Popups.popupWillDespawn", { popup: popup });

		//  Detach popup from its spawning target.
		Popups.detachPopupFromTarget(popup);

		//  Remove popup from the page.
		popup.remove();

		//  Remove popup from its popup stack.
		popup.popupStack.remove(popup);
		popup.popupStack = null;

		//	Mark popup as despawned.
		popup.isDespawned = true;

		//  Update z-indexes of all popups.
		Popups.updatePopupsZOrder();

		//  Enable/disable main document scrolling.
		Popups.updatePageScrollState();

		//	Reset cursor to normal.
		requestAnimationFrame(() => {
			Popups.clearWaitCursorForTarget(popup.spawningTarget);
		});

        document.activeElement.blur();
    },

	getPopupAncestorStack: (popup) => {
		let indexOfPopup = popup.popupStack.indexOf(popup);
		if (indexOfPopup != -1) {
			return popup.popupStack.slice(0, indexOfPopup + 1);
		} else {
			let parentPopup = Popups.containingPopFrame(popup.spawningTarget);
			return ((parentPopup && parentPopup.popupStack)
				    ? Popups.getPopupAncestorStack(parentPopup)
				    : [ ]);
		}
	},

	isSpawned: (popup) => {
		return (   popup
				&& popup.parentElement
				&& popup.classList.contains("fading") == false);
	},

	/********************/
	/*  Popup collapsing.
	 */
	popupIsCollapsed: (popup) => {
		return popup.classList.contains("collapsed");
	},

	collapseOrUncollapsePopup: (popup) => {
		GWLog("Popups.collapseOrUncollapsePopup", "popups.js", 2);

		if (Popups.popupIsCollapsed(popup)) {
			Popups.uncollapsePopup(popup);
		} else {
			Popups.collapsePopup(popup);
		}

		//  Cache the viewport rect.
		popup.viewportRect = popup.getBoundingClientRect();
	},

	collapsePopup: (popup) => {
		GWLog("Popups.collapsePopup", "popups.js", 3);

		//  Update class.
		Popups.addClassesToPopFrame(popup, "collapsed");

		//  Save and unset height, if need be.
		if (popup.style.height) {
			popup.dataset.previousHeight = popup.style.height;
			popup.style.height = "";
		}

		//  Pin popup.
		Popups.pinPopup(popup);

		//  Clear timers.
		Popups.clearPopupTimers(popup.spawningTarget);

		//  Update title bar buttons states (if any).
		if (popup.titleBar)
			popup.titleBar.updateState();
	},

	uncollapsePopup: (popup) => {
		GWLog("Popups.uncollapsePopup", "popups.js", 3);

		//  Update class.
		Popups.removeClassesFromPopFrame(popup, "collapsed");

		//  Restore height, if need be.
		if (popup.dataset.previousHeight) {
			if (Popups.popupIsPinned(popup) == true)
				popup.style.height = popup.dataset.previousHeight;

			//  Delete saved height.
			delete popup.dataset["previousHeight"];
		}

		//  Clear timers.
		Popups.clearPopupTimers(popup.spawningTarget);

		//  Update title bar buttons states (if any).
		if (popup.titleBar)
			popup.titleBar.updateState();
	},

	/********************************************************/
	/*  Popup pinning/unpinning, zooming/tiling, & restoring.
	 */

	/*  Popup tiling control keys.
	 */
	popupTilingControlKeys: (localStorage.getItem("popup-tiling-control-keys") || ""),
	//	This function is currently unused (but should be used in the future).
	//		—SA, 2022-02-01
	setPopupTilingControlKeys: (keystring) => {
		GWLog("Popups.setPopupTilingControlKeys", "popups.js", 1);

		Popups.popupTilingControlKeys = keystring || "aswdqexzfcv";
		localStorage.setItem("popup-tiling-control-keys", Popups.popupTilingControlKeys);
	},

	popupIsResizeable: (popup) => {
		return (   Popups.popupIsPinned(popup)
				&& (   Popups.popupAllowsHorizontalResize(popup)
					|| Popups.popupAllowsVerticalResize(popup)));
	},

	popupAllowsHorizontalResize: (popup) => {
		return (popup.classList.contains("no-resize-width") == false);
	},

	popupAllowsVerticalResize: (popup) => {
		return (   popup.classList.contains("no-resize-height") == false
				&& Popups.popupIsCollapsed(popup) == false);
	},

	popupIsZoomed: (popup) => {
		return popup.classList.contains("zoomed");
	},

	popupIsZoomedToPlace: (popup, place) => {
		return (   popup.classList.contains("zoomed")
				&& popup.classList.contains(place));
	},

	popupIsMaximized: (popup) => {
		return (popup.classList.contains("zoomed") && popup.classList.contains("full"));
	},

	popupWasRestored: (popup) => {
		return popup.classList.contains("restored");
	},

	popupIsPinned: (popup) => {
		return popup.classList.contains("pinned");
	},

	popupWasUnpinned: (popup) => {
		return popup.classList.contains("unpinned");
	},

	zoomPopup: (popup, place) => {
		GWLog("Popups.zoomPopup", "popups.js", 2);

		//  If popup isn’t already zoomed, save position.
		if (Popups.popupIsZoomed(popup) == false) {
			popup.dataset.previousXPosition = popup.viewportRect.left;
			popup.dataset.previousYPosition = popup.viewportRect.top;
		}

		//  If the popup is collapsed, expand it.
		if (Popups.popupIsCollapsed(popup))
			Popups.uncollapsePopup(popup);

		//  Update classes.
		Popups.removeClassesFromPopFrame(popup, "restored", ...(Popups.titleBarComponents.popupPlaces));
		Popups.addClassesToPopFrame(popup, "zoomed", place);

		//  Viewport width must account for vertical scroll bar.
		let viewportWidth = document.documentElement.offsetWidth;
		let viewportHeight = window.innerHeight;
		switch (place) {
			case "top-left":
				popup.zoomToX = 0.0;
				popup.zoomToY = 0.0;
				break;
			case "top":
				popup.zoomToX = 0.0;
				popup.zoomToY = 0.0;
				break;
			case "top-right":
				popup.zoomToX = viewportWidth / 2.0;
				popup.zoomToY = 0.0;
				break;
			case "left":
				popup.zoomToX = 0.0;
				popup.zoomToY = 0.0;
				break;
			case "full":
				popup.zoomToX = 0.0;
				popup.zoomToY = 0.0;
				break;
			case "right":
				popup.zoomToX = viewportWidth / 2.0;
				popup.zoomToY = 0.0;
				break;
			case "bottom-left":
				popup.zoomToX = 0.0;
				popup.zoomToY = viewportHeight / 2.0;
				break;
			case "bottom":
				popup.zoomToX = 0.0;
				popup.zoomToY = viewportHeight / 2.0;
				break;
			case "bottom-right":
				popup.zoomToX = viewportWidth / 2.0;
				popup.zoomToY = viewportHeight / 2.0;
				break;
		}

		//  Update popup position.
		Popups.positionPopup(popup);

		//  Update popup size.
		popup.style.maxWidth = "unset";
		popup.style.maxHeight = "unset";
		switch (place) {
			case "full":
				popup.style.width = "100%";
				popup.style.height = "100vh";
				break;
			case "left":
			case "right":
				popup.style.width = "50%";
				popup.style.height = "100vh";
				break;
			case "top":
			case "bottom":
				popup.style.width = "100%";
				popup.style.height = "50vh";
				break;
			case "top-left":
			case "top-right":
			case "bottom-left":
			case "bottom-right":
				popup.style.width = "50%";
				popup.style.height = "50vh";
				break;
		}
		popup.scrollView.style.maxHeight = "calc(100% - var(--popup-title-bar-height))";

		//  Pin popup.
		Popups.pinPopup(popup);

		//  Clear timers.
		Popups.clearPopupTimers(popup.spawningTarget);

		//  Enable/disable main document scrolling.
		Popups.updatePageScrollState();

		//  Update title bar buttons states (if any).
		if (popup.titleBar)
			popup.titleBar.updateState();
	},

	restorePopup: (popup) => {
		GWLog("Popups.restorePopup", "popups.js", 2);

		//  Update classes.
		Popups.removeClassesFromPopFrame(popup, "zoomed", "resized", ...(Popups.titleBarComponents.popupPlaces));
		Popups.addClassesToPopFrame(popup, "restored");

		//  Update popup size.
		popup.style.width = "";
		popup.style.height = "";
		popup.style.maxWidth = "";
		popup.style.maxHeight = "";
		popup.scrollView.style.maxHeight = "";

		//  Update popup position.
		Popups.positionPopup(popup);

		//  Clear timers.
		Popups.clearPopupTimers(popup.spawningTarget);

		//  Enable/disable main document scrolling.
		Popups.updatePageScrollState();

		//  Update title bar buttons states (if any).
		if (popup.titleBar)
			popup.titleBar.updateState();
	},

	pinOrUnpinPopup: (popup) => {
		GWLog("Popups.pinOrUnpinPopup", "popups.js", 2);

		if (Popups.popupIsPinned(popup) == true) {
			Popups.unpinPopup(popup);
		} else {
			Popups.pinPopup(popup);
		}
	},

	pinPopup: (popup) => {
		GWLog("Popups.pinPopup", "popups.js", 2);

		popup.swapClasses([ "pinned", "unpinned" ], 0);
		Popups.positionPopup(popup);
		popup.popupStack.remove(popup);
		Popups.detachPopupFromTarget(popup);

		popup.titleBar.updateState();
	},

	unpinPopup: (popup) => {
		GWLog("Popups.unpinPopup", "popups.js", 2);

		popup.swapClasses([ "pinned", "unpinned" ], 1);
		Popups.positionPopup(popup);
		popup.popupStack.push(popup);
		Popups.attachPopupToTarget(popup);

		popup.titleBar.updateState();
	},

	/******************/
	/*  Popup resizing.
	 */

	popupWasResized: (popup) => {
		return popup.classList.contains("resized");
	},

	edgeOrCorner: (popup, relativeMousePos) => {
		if (Popups.popupAllowsHorizontalResize(popup) == false) {
			let cornerHandleSize = popup.borderWidth;

			       if (relativeMousePos.y < cornerHandleSize) {
				return "edge-top";
			} else if (relativeMousePos.y > popup.viewportRect.height - cornerHandleSize) {
				return "edge-bottom";
			} else {
				return "";
			}
		} else if (Popups.popupAllowsVerticalResize(popup) == false) {
			let cornerHandleSize = popup.borderWidth;

			       if (relativeMousePos.x < cornerHandleSize) {
				return "edge-left";
			} else if (relativeMousePos.x > popup.viewportRect.width - cornerHandleSize) {
				return "edge-right";
			} else {
				return "";
			}
		} else {
			//  Make corner drag areas big enough to make a decent mouse target.
			let cornerHandleSize = Math.min(20.0, (Math.min(popup.viewportRect.width, popup.viewportRect.height) / 3.0));

				   if (   relativeMousePos.x < cornerHandleSize
					   && relativeMousePos.y < cornerHandleSize) {
				return "corner-top-left";
			} else if (   relativeMousePos.x > popup.viewportRect.width - cornerHandleSize
					   && relativeMousePos.y > popup.viewportRect.height - cornerHandleSize) {
				return "corner-bottom-right";
			} else if (   relativeMousePos.x < cornerHandleSize
					   && relativeMousePos.y > popup.viewportRect.height - cornerHandleSize) {
				return "corner-bottom-left";
			} else if (   relativeMousePos.x > popup.viewportRect.width - cornerHandleSize
					   && relativeMousePos.y < cornerHandleSize) {
				return "corner-top-right";
			} else if (relativeMousePos.x < cornerHandleSize) {
				return "edge-left";
			} else if (relativeMousePos.x > popup.viewportRect.width - cornerHandleSize) {
				return "edge-right";
			} else if (relativeMousePos.y < cornerHandleSize) {
				return "edge-top";
			} else if (relativeMousePos.y > popup.viewportRect.height - cornerHandleSize) {
				return "edge-bottom";
			} else {
				return "";
			}
		}
	},

	cursorForPopupBorder: (edgeOrCorner) => {
		switch (edgeOrCorner) {
		case "edge-top":
		case "edge-bottom":
			return "row-resize";
		case "edge-left":
		case "edge-right":
			return "col-resize";
		case "corner-top-left":
		case "corner-bottom-right":
			return "nwse-resize";
		case "corner-top-right":
		case "corner-bottom-left":
			return "nesw-resize";
		default:
			return "";
		}
	},

	/*******************/
	/*  Popup title bar.
	 */

	/*  Add title bar to a popup which has a populated .titleBarContents.
	 */
	addTitleBarToPopup: (popup) => {
		GWLog("Popups.addTitleBarToPopup", "popups.js", 2);

		//  Set class ‘has-title-bar’ on the popup.
		popup.classList.add("has-title-bar");

		//  Create and inject the title bar element.
		popup.titleBar = newElement("DIV");
		popup.titleBar.classList.add("popframe-title-bar");
		popup.titleBar.title = "Drag popup by title bar to reposition; double-click title bar to collapse (hold Option/Alt to collapse all)";
		popup.insertBefore(popup.titleBar, popup.firstElementChild);

		//  Add the provided title bar contents (buttons, title, etc.).
		popup.titleBarContents.forEach(element => {
			popup.titleBar.appendChild(element);

			if (element.buttonAction)
				element.addActivateEvent(element.buttonAction);

			//  Add popup-positioning submenu to zoom button.
			if (   element.classList.contains("zoom-button")
				&& element.submenuEnabled)
				Popups.titleBarComponents.addSubmenuToButton(element, "zoom-button-submenu", Popups.titleBarComponents.popupZoomButtons());
		});

		//  Add state-updating function.
		popup.titleBar.updateState = () => {
			popup.titleBar.querySelectorAll("button").forEach(button => {
				if (button.updateState)
					button.updateState();
			});
		};

		//  Add event listeners for dragging the popup by the title bar.
		popup.titleBar.addEventListener("mousedown", Popups.popupTitleBarMouseDown);
		popup.titleBar.addEventListener("mouseup", Popups.popupTitleBarMouseUp);

		//  Add double-click event listener for collapsing/uncollapsing the popup.
		popup.titleBar.addEventListener("dblclick", Popups.popupTitleBarDoubleClicked);
	},

	/*  Elements and methods related to popup title bars.
	 */
	titleBarComponents: {
		//  The standard positions for a popup to zoom to.
		popupPlaces: [ "top-left", "top", "top-right", "left", "full", "right", "bottom-left", "bottom", "bottom-right" ],

		getButtonIcon: (buttonType) => {
			let icon = Popups.titleBarComponents.buttonIcons[buttonType];
			return icon.startsWith("<") ? icon : GW.svg(icon);
// 			return GW.svg(Popups.titleBarComponents.buttonIcons[buttonType]);
		},

		/*  Icons for various popup title bar buttons.
			(Values are keys for GW.svg().)
		 */
		buttonIcons: {
			"close": "times-square-regular",
			"zoom": "arrows-maximize-solid",
			"restore": "compress-solid",
			"pin": "thumbtack-regular",
			"unpin": "thumbtack-solid",
			"options": "gear-solid",
			"zoom-top-left": "expand-arrows-up-left",
			"zoom-top": "expand-arrows-up",
			"zoom-top-right": "expand-arrows-up-right",
			"zoom-left": "expand-arrows-left",
			"zoom-full": "arrows-maximize-solid",
			"zoom-right": "expand-arrows-right",
			"zoom-bottom-left": "expand-arrows-down-left",
			"zoom-bottom": "expand-arrows-down",
			"zoom-bottom-right": "expand-arrows-down-right"
		},

		//  Tooltip text for various popup title bar icons.
		buttonTitles: {
			"close": "Close this popup (hold Option/Alt to close all)",
			"zoom": "Maximize this popup",
			"restore": "Restore this popup to normal size and position",
			"pin": "Pin this popup to the screen (hold Option/Alt to pin all)",
			"unpin": "Un-pin this popup from the screen (hold Option/Alt to pin all)",
			"options": "Show options",
			"zoom-top-left": "Place this popup in the top-left quarter of the screen",
			"zoom-top": "Place this popup on the top half of the screen",
			"zoom-top-right": "Place this popup in the top-right quarter of the screen",
			"zoom-left": "Place this popup on the left half of the screen",
			"zoom-right": "Place this popup on the right half of the screen",
			"zoom-full": "Expand this popup to fill the screen",
			"zoom-bottom-left": "Place this popup in the bottom-left quarter of the screen",
			"zoom-bottom": "Place this popup on the bottom half of the screen",
			"zoom-bottom-right": "Place this popup in the bottom-right quarter of the screen"
		},

		//  A generic button, with no icon or tooltip text.
		genericButton: () => {
			let button = newElement("BUTTON");
			button.classList.add("popframe-title-bar-button");

			button.buttonAction = (event) => { event.stopPropagation(); };

			return button;
		},

		//  Close button.
		closeButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.classList.add("close-button");

			button.innerHTML = Popups.titleBarComponents.getButtonIcon("close");
			button.title = Popups.titleBarComponents.buttonTitles["close"];

			button.buttonAction = (event) => {
				event.stopPropagation();

				if (event.altKey == true) {
					Popups.allSpawnedPopups().forEach(popup => {
						Popups.despawnPopup(popup);
					});
				} else {
					Popups.despawnPopup(Popups.containingPopFrame(event.target));
				}
			};

			return button;
		},

		//  Zoom button (with submenu).
		zoomButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.classList.add("zoom-button", "zoom");

			button.defaultHTML = Popups.titleBarComponents.getButtonIcon("zoom");
			button.alternateHTML = Popups.titleBarComponents.getButtonIcon("restore");
			button.innerHTML = button.defaultHTML;

			button.defaultTitle = Popups.titleBarComponents.buttonTitles["zoom"];
			button.alternateTitle = Popups.titleBarComponents.buttonTitles["restore"];
			button.title = button.defaultTitle;

			button.buttonAction = (event) => {
				event.stopPropagation();

				let popup = Popups.containingPopFrame(button);

				if (button.classList.contains("zoom")) {
					Popups.zoomPopup(popup, "full");
				} else {
					Popups.restorePopup(popup);
				}
			};

			button.updateState = () => {
				let popup = Popups.containingPopFrame(button);

				let alternateStateEnabled = (Popups.popupIsZoomed(popup) || Popups.popupWasResized(popup));

				button.innerHTML = alternateStateEnabled ? button.alternateHTML : button.defaultHTML;
				button.title = alternateStateEnabled ? button.alternateTitle : button.defaultTitle;

				button.swapClasses([ "zoom", "restore" ], (alternateStateEnabled ? 1 : 0));

				if (button.submenuEnabled == true) {
					button.submenu.querySelectorAll(".submenu-button").forEach(submenuButton => {
						submenuButton.updateState();
					});
				}
			};

			button.enableSubmenu = () => {
				button.submenuEnabled = true;
				return button;
			};

			return button;
		},

		//  Zoom buttons (to be put into zoom button submenu).
		popupZoomButtons: () => {
			return Popups.titleBarComponents.popupPlaces.map(place => {
				let button = Popups.titleBarComponents.genericButton();

				button.classList.add("submenu-button", "zoom-button", place);

				button.defaultHTML = Popups.titleBarComponents.getButtonIcon(`zoom-${place}`);
				button.alternateHTML = Popups.titleBarComponents.getButtonIcon("restore");
				button.innerHTML = button.defaultHTML;

				button.defaultTitle = Popups.titleBarComponents.buttonTitles[`zoom-${place}`];
				button.alternateTitle = Popups.titleBarComponents.buttonTitles["restore"];
				button.title = button.defaultTitle;

				button.buttonAction = (event) => {
					event.stopPropagation();

					let popup = Popups.containingPopFrame(button);

					if (button.classList.contains(`zoom-${place}`)) {
						Popups.zoomPopup(popup, place);
					} else {
						Popups.restorePopup(popup);
					}
				};

				button.updateState = () => {
					let popup = Popups.containingPopFrame(button);

					let alternateStateEnabled = Popups.popupIsZoomedToPlace(popup, place);

					button.innerHTML = alternateStateEnabled ? button.alternateHTML : button.defaultHTML;
					button.title = alternateStateEnabled ? button.alternateTitle : button.defaultTitle;

					button.swapClasses([ `zoom-${place}`, "restore" ], (alternateStateEnabled ? 1 : 0));
				};

				return button;
			});
		},

		//  Pin button.
		pinButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.classList.add("pin-button", "pin");

			button.defaultHTML = Popups.titleBarComponents.getButtonIcon("pin");
			button.alternateHTML = Popups.titleBarComponents.getButtonIcon("unpin");
			button.innerHTML = button.defaultHTML;

			button.defaultTitle = Popups.titleBarComponents.buttonTitles["pin"];
			button.alternateTitle = Popups.titleBarComponents.buttonTitles["unpin"];
			button.title = button.defaultTitle;

			button.buttonAction = (event) => {
				event.stopPropagation();

				let popup = Popups.containingPopFrame(button);

				if (event.altKey == true) {
					let action = Popups.popupIsPinned(popup) ? "unpinPopup" : "pinPopup";
					Popups.allSpawnedPopups().forEach(popup => {
						Popups[action](popup);
					});
				} else {
					Popups.pinOrUnpinPopup(popup);
				}
			};

			button.updateState = () => {
				let popup = Popups.containingPopFrame(button);

				button.innerHTML = Popups.popupIsPinned(popup) ? button.alternateHTML : button.defaultHTML;
				button.title = Popups.popupIsPinned(popup) ? button.alternateTitle : button.defaultTitle;

				button.swapClasses([ "pin", "unpin" ], (Popups.popupIsPinned(popup) ? 1 : 0));
			};

			return button;
		},

		//  Options button (does nothing by default).
		optionsButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.classList.add("options-button");

			button.innerHTML = Popups.titleBarComponents.getButtonIcon("options");
			button.title = Popups.titleBarComponents.buttonTitles["options"];

			return button;
		},

		/*  Add a submenu of the given class and with given buttons to a button.
		 */
		addSubmenuToButton: (button, submenuClass, submenuButtons) => {
			let popup = Popups.containingPopFrame(button);

			button.classList.add("has-submenu");

			button.submenu = newElement("DIV");
			button.submenu.classList.add("submenu", submenuClass);

			popup.titleBar.insertBefore(button.submenu, button.nextElementSibling);

			submenuButtons.forEach(submenuButton => {
				button.submenu.appendChild(submenuButton);
				if (submenuButton.buttonAction)
					submenuButton.addActivateEvent(submenuButton.buttonAction);
			});
		},
	},

	/******************/
	/*	Optional parts.
	 */

	addPartToPopFrame: (popup, part) => {
		popup.append(part);
	},

	/************************/
	/*	Optional UI elements.
	 */

	addUIElementsToPopFrame: (popup, ...args) => {
		popup.uiElementsContainer.append(...args);
	},

	/*********************/
	/*	Popups z-ordering.
	 */

	updatePopupsZOrder: () => {
		GWLog("Popups.updatePopupsZOrder", "popups.js", 3);

		let allPopups = Popups.allSpawnedPopups();
		allPopups.sort((a, b) => parseInt(a.style.zIndex) - parseInt(b.style.zIndex));
		for (let i = 0; i < allPopups.length; i++)
			allPopups[i].style.zIndex = i + 1;

		//  Focus the front-most popup.
		Popups.focusPopup(Popups.frontmostPopup());
	},

	popupIsFrontmost: (popup) => {
		return (parseInt(popup.style.zIndex) == Popups.allSpawnedPopups().length);
	},

	frontmostPopup: () => {
		let allPopups = Popups.allSpawnedPopups();
		return allPopups.find(popup => parseInt(popup.style.zIndex) == allPopups.length);
	},

	bringPopupToFront: (popup) => {
		GWLog("Popups.bringPopupToFront", "popups.js", 3);

		//  If it’s already at the front, do nothing.
		if (Popups.popupIsFrontmost(popup))
			return;

		//  Set z-index.
		popup.style.zIndex = (Popups.allSpawnedPopups().length + 1);

		//  Update z-indexes of all popups.
		Popups.updatePopupsZOrder();
	},

	/******************/
	/*  Popup focusing.
	 */

	popupIsFocused: (popup) => {
		return popup.classList.contains("focused");
	},

	focusedPopup: () => {
		return Popups.allSpawnedPopups().find(popup => Popups.popupIsFocused(popup));
	},

	focusPopup: (popup) => {
		GWLog("Popups.focusPopup", "popups.js", 3);

		//  Un-focus any focused popups.
		Popups.allSpawnedPopups().forEach(spawnedPopup => {
			Popups.removeClassesFromPopFrame(spawnedPopup, "focused");
		});

		//  Focus the given popup.
		if (popup)
			Popups.addClassesToPopFrame(popup, "focused");
	},

	/*********************/
	/*  Popup positioning.
	 */

	/*	Returns full viewport rect for popup and all auxiliary elements
		(footers, etc.).
	 */
	getPopupViewportRect: (popup) => {
		return rectUnion(popup.getBoundingClientRect(), ...(Array.from(popup.children).map(x => x.getBoundingClientRect())));
	},

	//	See also: extracts.js
	preferSidePositioning: (target) => {
		return target.preferSidePositioning ? target.preferSidePositioning() : false;
	},

	/*	Returns current popup position. (Usable only after popup is positioned.)
	 */
	popupPosition: (popup) => {
		return {
			x: parseInt(popup.style.left),
			y: parseInt(popup.style.top)
		};
	},

	positionPopup: (popup, spawnPoint, tight = false) => {
		GWLog("Popups.positionPopup", "popups.js", 2);

		let target = popup.spawningTarget;
		if (spawnPoint)
			target.lastMouseEnterLocation = spawnPoint;
		else if (target.lastMouseEnterLocation)
			spawnPoint = target.lastMouseEnterLocation;
		else
			return;

		/*	When the target’s bounding rect is composed of multiple client rects
			(as when the target is a link that wraps across a line break), we
			must select the right rect, to prevent the popup from spawning far
			away from the cursor.
		 */
		let targetViewportRect =    Array.from(target.getClientRects()).find(rect => pointWithinRect(spawnPoint, rect))
								 || target.getBoundingClientRect();

		//  Wait for the “naive” layout to be completed, and then...
		requestAnimationFrame(() => {
			//	Clear popup position.
			popup.style.left = "";
			popup.style.top = "";

			/*  This is the width and height of the popup, as already determined
				by the layout system, and taking into account the popup’s content,
				and the max-width, min-width, etc., CSS properties.
			 */
			let popupIntrinsicRect = Popups.getPopupViewportRect(popup);
			let popupIntrinsicWidth = popupIntrinsicRect.width;
			let popupIntrinsicHeight = popupIntrinsicRect.height;

			let provisionalPopupXPosition = 0.0;
			let provisionalPopupYPosition = 0.0;

			let offToTheSide = false;
			let popupSpawnYOriginForSpawnAbove = targetViewportRect.top
											   - (tight ? Popups.popupBreathingRoomYTight : Popups.popupBreathingRoomY);
			let popupSpawnYOriginForSpawnBelow = targetViewportRect.bottom
											   + (tight ? Popups.popupBreathingRoomYTight : Popups.popupBreathingRoomY);
			if (   Popups.containingPopFrame(target)
				|| Popups.preferSidePositioning(target)) {
				/*  The popup is a nested popup, or the target specifies that it
					prefers to have popups spawned to the side; we try to put
					the popup off to the left or right.
				 */
				offToTheSide = true;
			}

			provisionalPopupYPosition = spawnPoint.y - ((spawnPoint.y / window.innerHeight) * popupIntrinsicHeight);
			if (provisionalPopupYPosition < 0.0)
				provisionalPopupYPosition = 0.0;

			//  Determine whether to put the popup off to the right, or left.
			if (  targetViewportRect.right
				+ Popups.popupBreathingRoomX
				+ popupIntrinsicWidth
				  <= document.documentElement.offsetWidth) {
				//  Off to the right.
				provisionalPopupXPosition = targetViewportRect.right + Popups.popupBreathingRoomX;
			} else if (  targetViewportRect.left
					   - Popups.popupBreathingRoomX
					   - popupIntrinsicWidth
						 >= 0) {
				//  Off to the left.
				provisionalPopupXPosition = targetViewportRect.left - popupIntrinsicWidth - Popups.popupBreathingRoomX;
			} else {
				//  Not off to either side, in fact.
				offToTheSide = false;
			}

			/*  Can the popup fit above the target? If so, put it there.
				Failing that, can it fit below the target? If so, put it there.
			 */
			if (offToTheSide == false) {
				if (  popupSpawnYOriginForSpawnAbove
					- popupIntrinsicHeight
					  >= 0) {
					//  Above.
					provisionalPopupYPosition = popupSpawnYOriginForSpawnAbove - popupIntrinsicHeight;
				} else if (  popupSpawnYOriginForSpawnBelow
						   + popupIntrinsicHeight
						     <= window.innerHeight) {
					//  Below.
					provisionalPopupYPosition = popupSpawnYOriginForSpawnBelow;
				} else {
					//  The popup does not fit above or below!
					if (tight == false) {
						//	Let’s try and pack it in more tightly...
						Popups.positionPopup(popup, null, true);
						return;
					} else {
						/*	... or, failing that, we will have to put it off to
							the right after all.
						 */
						offToTheSide = true;
					}
				}
			}

			if (offToTheSide == false) {
				/*  Place popup off to the right (and either above or below),
					as per the previous block of code.
				 */
				provisionalPopupXPosition = spawnPoint.x + Popups.popupBreathingRoomX;
			}

			/*  Does the popup extend past the right edge of the container?
				If so, move it left, until its right edge is flush with
				the container’s right edge.
			 */
			if (  provisionalPopupXPosition
				+ popupIntrinsicWidth
				  > document.documentElement.offsetWidth) {
				//  We add 1.0 here to prevent wrapping due to rounding.
				provisionalPopupXPosition -= (provisionalPopupXPosition + popupIntrinsicWidth - document.documentElement.offsetWidth + 1.0);
			}

			/*  Now (after having nudged the popup left, if need be),
				does the popup extend past the *left* edge of the container?
				Make its left edge flush with the container's left edge.
			 */
			if (provisionalPopupXPosition < 0)
				provisionalPopupXPosition = 0;

			//  Special cases for maximizing/restoring and pinning/unpinning.
			let getPositionToRestore = (popup) => {
				xPos = parseFloat(popup.dataset.previousXPosition);
				yPos = parseFloat(popup.dataset.previousYPosition);

				//  Clear saved position.
				delete popup.dataset.previousXPosition;
				delete popup.dataset.previousYPosition;

				Popups.removeClassesFromPopFrame(popup, "restored");

				return [ xPos, yPos ];
			};
			if (Popups.popupIsZoomed(popup)) {
				provisionalPopupXPosition = popup.zoomToX;
				provisionalPopupYPosition = popup.zoomToY;
			} else if (Popups.popupIsPinned(popup) == true) {
				if (Popups.popupWasRestored(popup)) {
					[ provisionalPopupXPosition, provisionalPopupYPosition ] = getPositionToRestore(popup);
				} else {
					provisionalPopupXPosition = popup.viewportRect.left;
					provisionalPopupYPosition = popup.viewportRect.top;
				}
			} else {
				if (Popups.popupWasUnpinned(popup)) {
					provisionalPopupXPosition = popup.viewportRect.left;
					provisionalPopupYPosition = popup.viewportRect.top;

					Popups.removeClassesFromPopFrame(popup, "unpinned");
				} else if (Popups.popupWasRestored(popup)) {
					[ provisionalPopupXPosition, provisionalPopupYPosition ] = getPositionToRestore(popup);
				}
			}

			//  Set only position, not size.
			Popups.setPopupViewportRect(popup, new DOMRect(provisionalPopupXPosition, provisionalPopupYPosition, 0, 0));

			//  Cache the viewport rect.
			popup.viewportRect = popup.getBoundingClientRect();

			document.activeElement.blur();
		});
	},

	setPopupViewportRect: (popup, rect, options = { }) => {
		GWLog("Popups.setPopupViewportRect", "popups.js", 3);

		if (options.clampPositionToScreen) {
			//  Viewport width must account for vertical scroll bar.
			let viewportWidth = document.documentElement.offsetWidth;
			let viewportHeight = window.innerHeight;

			//	Clamp position to screen, keeping size constant.
			rect.x = valMinMax(rect.x,
							   0,
							   viewportWidth - (rect.width || popup.viewportRect.width));
			rect.y = valMinMax(rect.y,
							   0,
							   viewportHeight - (rect.height || popup.viewportRect.height));
		}

		if (Popups.popupIsPinned(popup) == false) {
            let popupContainerViewportRect = Popups.popupContainer.getBoundingClientRect();
			rect.x -= popupContainerViewportRect.left;
			rect.y -= popupContainerViewportRect.top;
		}

		popup.style.position = Popups.popupIsPinned(popup) ? "fixed" : "";

		popup.style.left = `${(Math.round(rect.x))}px`;
		popup.style.top = `${(Math.round(rect.y))}px`;

		if (   rect.width > 0
			&& rect.height > 0) {
			popup.style.maxWidth = "unset";
			popup.style.maxHeight = "unset";

			popup.style.width = `${(Math.round(rect.width))}px`;
			popup.style.height = `${(Math.round(rect.height))}px`;

			popup.scrollView.style.maxHeight = "calc(100% - var(--popup-title-bar-height))";
		}
	},

	/****************/
	/*	Popup timers.
	 */

    clearPopupTimers: (target) => {
	    GWLog("Popups.clearPopupTimers", "popups.js", 3);

		if (target.popup)
			Popups.removeClassesFromPopFrame(target.popup, "fading");

        clearTimeout(target.popupFadeTimer);
        clearTimeout(target.popupDespawnTimer);
        clearTimeout(target.popupSpawnTimer);
    },

	setPopupSpawnTimer: (target, event) => {
		GWLog("Popups.setPopupSpawnTimer", "popups.js", 2);

		let popupTriggerDelay = target.specialPopupTriggerDelay != null
								? (typeof target.specialPopupTriggerDelay == "function"
								   ? target.specialPopupTriggerDelay()
								   : target.specialPopupTriggerDelay)
								: Popups.popupTriggerDelay;
		target.popupSpawnTimer = setTimeout(() => {
			GWLog("Popups.popupSpawnTimer fired", "popups.js", 2);

			//	Spawn the popup.
			Popups.spawnPopup(target, { x: event.clientX, y: event.clientY });
		}, popupTriggerDelay);
	},

    setPopupFadeTimer: (target) => {
		GWLog("Popups.setPopupFadeTimer", "popups.js", 2);

        target.popupFadeTimer = setTimeout(() => {
			GWLog("popupFadeTimer fired", "popups.js", 2);

			Popups.setPopupDespawnTimer(target);
        }, Popups.popupFadeoutDelay);
    },

    setPopupDespawnTimer: (target) => {
		GWLog("Popups.setPopupDespawnTimer", "popups.js", 2);

		Popups.addClassesToPopFrame(target.popup, "fading");
		target.popupDespawnTimer = setTimeout(() => {
			GWLog("popupDespawnTimer fired", "popups.js", 2);

			Popups.despawnPopup(target.popup);
		}, Popups.popupFadeoutDuration);
    },

	/********************************/
	/*	Popup progress UI indicators.
	 */

	setWaitCursorForTarget: (target) => {
		GWLog("Popups.setWaitCursorForTarget", "popups.js", 2);

		document.documentElement.style.cursor = "progress";
		target.style.cursor = "progress";
		if (target.popup)
			target.popup.style.cursor = "progress";
	},

	clearWaitCursorForTarget: (target) => {
		GWLog("Popups.clearWaitCursorForTarget", "popups.js", 3);

		document.documentElement.style.cursor = "";
		target.style.cursor = "";
		if (target.popup)
			target.popup.style.cursor = "";
	},

	/*******************/
	/*  Event listeners.
	 */

   /*	The “user moved mouse out of popup” mouseleave event.
    */
    //	Added by: Popups.injectPopup
	popupMouseLeave: (event) => {
		GWLog("Popups.popupMouseLeave", "popups.js", 2);

		if (Popups.popupBeingDragged)
			return;

		if (Popups.popupContainerIsVisible() == false)
			return;

		Popups.getPopupAncestorStack(event.target).reverse().forEach(popupInStack => {
			Popups.clearPopupTimers(popupInStack.spawningTarget);
			Popups.setPopupFadeTimer(popupInStack.spawningTarget);
		});
	},

	/*	The “user moved mouse back into popup” mouseenter event.
	 */
	//	Added by: Popups.injectPopup
	popupMouseEnter: (event) => {
		GWLog("Popups.popupMouseEnter", "popups.js", 2);

		Popups.getPopupAncestorStack(event.target).forEach(popupInStack => {
			Popups.clearPopupTimers(popupInStack.spawningTarget);
		});
	},

	/*  The “user clicked in body of popup” event.
	 */
	//	Added by: Popups.injectPopup
    popupClicked: (event) => {
		GWLog("Popups.popupClicked", "popups.js", 2);

		let popup = Popups.containingPopFrame(event.target);

		if (   Popups.popupIsFrontmost(popup) == false
			&& event.metaKey == false)
			Popups.bringPopupToFront(popup);

		event.stopPropagation();

		Popups.clearPopupTimers(popup.spawningTarget);
    },

	/*  The popup mouse down event (for resizing by dragging an edge/corner).
	 */
	//	Added by: Popups.injectPopup
	popupMouseDown: (event) => {
		GWLog("Popups.popupMouseDown", "popups.js", 2);

		//  Prevent other events from triggering.
		event.stopPropagation();

		//  Get the containing popup.
		let popup = Popups.containingPopFrame(event.target);

		/*  Make sure we’re clicking on the popup (ie. its edge) and not
			on any of the popup’s contained elements; that this is a
			left-click; and that the popup is pinned or zoomed.
		 */
		if (   event.target != popup
			|| event.button != 0
			|| Popups.popupIsResizeable(popup) == false)
			return;

		//  Bring the popup to the front.
		if (event.metaKey == false)
			Popups.bringPopupToFront(popup);

		//  Prevent clicks from doing anything other than what we want.
		event.preventDefault();

		//  Determine direction of resizing.
		let edgeOrCorner = Popups.edgeOrCorner(popup, {
			x: event.clientX - popup.viewportRect.left,
			y: event.clientY - popup.viewportRect.top
		});

		//	Perhaps we cannot resize in this direction?
		if (edgeOrCorner == "")
			return;

		//  Mark popup as currently being resized.
		Popups.addClassesToPopFrame(popup, "resizing");

		//  Save position, if need be.
		if (   !("previousXPosition" in popup.dataset)
			&& !("previousYPosition" in popup.dataset)) {
			popup.dataset.previousXPosition = popup.viewportRect.left;
			popup.dataset.previousYPosition = popup.viewportRect.top;
		}

		//  Point where the drag began.
		let dragStartMouseCoordX = event.clientX;
		let dragStartMouseCoordY = event.clientY;

		//  Popup initial rect.
		let newPopupViewportRect = DOMRect.fromRect(popup.viewportRect);

		/*  Add the mouse up event listener (to window, not the popup, because
			the drag might end anywhere, due to animation lag).
		 */
		window.addEventListener("mouseup", Popups.popupResizeMouseUp);

		//  Viewport width must account for vertical scroll bar.
		let viewportWidth = document.documentElement.offsetWidth;
		let viewportHeight = window.innerHeight;

		//  Popup minimum width/height.
		let popupMinWidth = parseFloat(getComputedStyle(popup).minWidth);
		let popupMinHeight = parseFloat(getComputedStyle(popup).minHeight);

		//  The mousemove event that triggers the continuous resizing.
		window.onmousemove = (event) => {
			window.popupBeingResized = popup;

			Popups.removeClassesFromPopFrame(popup, ...(Popups.titleBarComponents.popupPlaces));
			Popups.addClassesToPopFrame(popup, "resized");

			let deltaX = event.clientX - dragStartMouseCoordX;
			let deltaY = event.clientY - dragStartMouseCoordY;

			let resizeTop = () => {
				newPopupViewportRect.y = valMinMax(popup.viewportRect.y + deltaY, 0, popup.viewportRect.bottom - popupMinHeight);
				newPopupViewportRect.height = popup.viewportRect.bottom - newPopupViewportRect.y;
			};
			let resizeBottom = () => {
				newPopupViewportRect.height = valMinMax(popup.viewportRect.height + deltaY, popupMinHeight, viewportHeight - popup.viewportRect.y);
			};
			let resizeLeft = () => {
				newPopupViewportRect.x = valMinMax(popup.viewportRect.x + deltaX, 0, popup.viewportRect.right - popupMinWidth);
				newPopupViewportRect.width = popup.viewportRect.right - newPopupViewportRect.x;
			};
			let resizeRight = () => {
				newPopupViewportRect.width = valMinMax(popup.viewportRect.width + deltaX, popupMinWidth, viewportWidth - popup.viewportRect.x);
			};

			switch (edgeOrCorner) {
				case "edge-top":
					resizeTop();
					break;
				case "edge-bottom":
					resizeBottom();
					break;
				case "edge-left":
					resizeLeft();
					break;
				case "edge-right":
					resizeRight();
					break;
				case "corner-top-left":
					resizeTop();
					resizeLeft();
					break;
				case "corner-bottom-right":
					resizeBottom();
					resizeRight();
					break;
				case "corner-top-right":
					resizeTop();
					resizeRight();
					break;
				case "corner-bottom-left":
					resizeBottom();
					resizeLeft();
					break;
			}

			Popups.setPopupViewportRect(popup, newPopupViewportRect);
		};
	},

	/*  The resize-end mouseup event.
	 */
	//	Added by: Popups.popupMouseDown
	popupResizeMouseUp: (event) => {
		GWLog("Popups.popupResizeMouseUp", "popups.js", 2);

		event.stopPropagation();

		window.onmousemove = null;

		//  Reset cursor to normal.
		document.documentElement.style.cursor = "";

		let popup = window.popupBeingResized;
		if (popup) {
			Popups.removeClassesFromPopFrame(popup, "resizing");

			if (Popups.popupWasResized(popup))
				popup.titleBar.updateState();

			//  Cache the viewport rect.
			popup.viewportRect = popup.getBoundingClientRect();
		}
		window.popupBeingResized = null;

		window.removeEventListener("mouseup", Popups.popupResizeMouseUp);
	},

	/*  The popup mouseout event.
	 */
	//	Added by: Popups.injectPopup
	popupMouseOut: (event) => {
		GWLog("Popups.popupMouseOut", "popups.js", 3);

		//  Reset cursor.
		if (   Popups.popupBeingDragged == null
			&& event.target.style.cursor == "")
			document.documentElement.style.cursor = "";
	},

	/*  The popup title bar mouseup event.
	 */
	//	Added by: Popups.addTitleBarToPopup
	popupTitleBarMouseDown: (event) => {
		GWLog("Popups.popupTitleBarMouseDown", "popups.js", 2);

		//  Prevent other events from triggering.
		event.stopPropagation();

		//  Get the containing popup.
		let popup = Popups.containingPopFrame(event.target);

		//  Bring the popup to the front.
		if (event.metaKey == false)
			Popups.bringPopupToFront(popup);

		//  We only want to do anything on left-clicks.
		if (event.button != 0)
			return;

		//  Also do nothing if the click is on a title bar button.
		if (event.target.closest(".popframe-title-bar-button"))
			return;

		//  Prevent clicks from doing anything other than what we want.
		event.preventDefault();

		//  Mark popup as grabbed.
		Popups.addClassesToPopFrame(popup, "grabbed");

		//  Change cursor to “grabbing hand”.
		document.documentElement.style.cursor = "grabbing";

		/*  If the mouse-down event is on the popup title (and the title
			is a link).
		 */
		popup.linkDragTarget = event.target.closest("a");

		/*  Deal with edge case where drag to screen bottom ends up
			with the mouse-up event happening in the popup body.
		 */
		popup.removeEventListener("click", Popups.popupClicked);

		//  Point where the drag began.
		let dragStartMouseCoordX = event.clientX;
		let dragStartMouseCoordY = event.clientY;

		//  Popup initial position.
		let newPopupViewportRect = DOMRect.fromRect(popup.viewportRect);
		//  Do not change popup size.
		newPopupViewportRect.width = 0;
		newPopupViewportRect.height = 0;

		//  Add the drag-end mouseup listener.
		window.addEventListener("mouseup", Popups.popupDragMouseUp);

		//  We define the mousemove listener here to capture variables.
		window.onmousemove = (event) => {
			Popups.popupBeingDragged = popup;

			//  Mark popup as being dragged.
			Popups.addClassesToPopFrame(popup, "dragging");

			//  If dragging by the title, disable its normal click handler.
			if (popup.linkDragTarget)
				popup.linkDragTarget.onclick = (event) => { return false; };

			//  Current drag vector relative to mouse starting position.
			newPopupViewportRect.x = popup.viewportRect.x + (event.clientX - dragStartMouseCoordX);
			newPopupViewportRect.y = popup.viewportRect.y + (event.clientY - dragStartMouseCoordY);

			//  Set new viewport rect; clamp to screen.
			Popups.setPopupViewportRect(popup, newPopupViewportRect, { clampPositionToScreen: true });
		};
	},

	/*  The mouseup event that ends a popup drag-to-move.
	 */
	//	Added by: Popups.popupTitleBarMouseDown
	popupDragMouseUp: (event) => {
		GWLog("Popups.popupDragMouseUp", "popups.js", 2);

		//  Prevent other events from triggering.
		event.stopPropagation();

		//  Remove the mousemove handler.
		window.onmousemove = null;

		//  Reset cursor to normal.
		document.documentElement.style.cursor = "";

		let popup = Popups.popupBeingDragged;
		if (popup) {
			Popups.removeClassesFromPopFrame(popup, "grabbed", "dragging");

			//  Re-enable clicking on the title.
			if (popup.linkDragTarget) {
				requestAnimationFrame(() => {
					popup.linkDragTarget.onclick = null;
					popup.linkDragTarget = null;
				});
			}

			//  Cache the viewport rect.
			popup.viewportRect = popup.getBoundingClientRect();

			//  Ensure that the click listener isn’t fired at once.
			requestAnimationFrame(() => {
				popup.addEventListener("click", Popups.popupClicked);
			});

			/*  If the drag of a non-pinned popup ended outside the
				popup (possibly outside the viewport), treat this
				as mousing out of the popup.
			 */
			if (   (   event.target.closest == null
				    || Popups.containingPopFrame(event.target) == null)
				&& Popups.popupIsPinned(popup) == false) {
				Popups.getPopupAncestorStack(popup).reverse().forEach(popupInStack => {
					Popups.clearPopupTimers(popupInStack.spawningTarget);
					Popups.setPopupFadeTimer(popupInStack.spawningTarget);
				});
			}

			//  Pin popup.
			Popups.pinPopup(popup);
		}
		Popups.popupBeingDragged = null;

		//  Remove the listener (ie. we only want this fired once).
		window.removeEventListener("mouseup", Popups.popupDragMouseUp);
	},

	/*  The popup title bar mouseup event.
	 */
	//	Added by: Popups.addTitleBarToPopup
	popupTitleBarMouseUp: (event) => {
		GWLog("Popups.popupTitleBarMouseUp", "popups.js", 2);

		Popups.containingPopFrame(event.target).classList.toggle("grabbed", false);
	},

	/*  The popup title bar double-click event.
	 */
	//	Added by: Popups.addTitleBarToPopup
	popupTitleBarDoubleClicked: (event) => {
		GWLog("Popups.popupTitleBarDoubleClicked", "popups.js", 2);

		let popup = Popups.containingPopFrame(event.target);

		if (event.altKey == true) {
			let expand = Popups.popupIsCollapsed(Popups.containingPopFrame(event.target));
			Popups.allSpawnedPopups().forEach(popup => {
				if (expand)
					Popups.uncollapsePopup(popup);
				else
					Popups.collapsePopup(popup);
			});
		} else {
			Popups.collapseOrUncollapsePopup(popup);
		}
	},

	/*	The target mouseenter event.
	 */
	//	Added by: Popups.addTargetsWithin
	targetMouseEnter: (event) => {
		GWLog("Popups.targetMouseEnter", "popups.js", 2);

		if (Popups.popupBeingDragged)
			return;

		if (Popups.hoverEventsActive == false)
			return;

		//	Stop the countdown to un-pop the popup.
		Popups.clearPopupTimers(event.target);

		if (event.target.popup == null) {
			//  Start the countdown to pop up the popup (if not already spawned).
			Popups.setPopupSpawnTimer(event.target, event);
		} else {
			/*  If already spawned, just bring the popup to the front and
				re-position it.
			 */
			Popups.bringPopupToFront(event.target.popup);
			Popups.positionPopup(event.target.popup, { x: event.clientX, y: event.clientY });
		}
	},

	/*	The target mouseleave event.
	 */
	//	Added by: Popups.addTargetsWithin
	targetMouseLeave: (event) => {
		GWLog("Popups.targetMouseLeave", "popups.js", 2);

		event.target.lastMouseEnterEvent = null;

		Popups.clearPopupTimers(event.target);

		if (event.target.popup)
			Popups.setPopupFadeTimer(event.target);
	},

    /*	The “user (left- or right-) clicked target” mousedown event.
     */
    //	Added by: Popups.addTargetsWithin
	targetMouseDown: (event) => {
		GWLog("Popups.targetMouseDown", "popups.js", 2);

		if (Popups.popupBeingDragged)
			return;

		if (   event.target.closest(".popframe-ui-elements-container")
			&& event.button == 0)
			return;

		/*	Unlike ‘mouseenter’ and ‘mouseleave’, ‘mousedown’ behaves like
			‘mouseover’/‘mouseout’ in that it attaches to the innermost element,
			which might not be our spawning target (but instead some descendant
			element); we must find the actual spawning target.
		 */
		let target = event.target.closest(".spawns-popup");

		//	Cancel spawning of popups from the target.
		Popups.clearPopupTimers(target);

		//	Despawn any (non-pinned) popup already spawned from the target.
		if (target.popup)
			Popups.despawnPopup(target.popup);
	},

	/*  The keyup event.
	 */
	//	Added by: Popups.setup
	keyUp: (event) => {
		GWLog("Popups.keyUp", "popups.js", 3);
		let allowedKeys = [ "Escape", "Esc", ...(Popups.popupTilingControlKeys.split("")) ];
		if (   allowedKeys.includes(event.key) == false
			|| Popups.allSpawnedPopups().length == 0)
			return;

		event.preventDefault();

		switch(event.key) {
			case "Escape":
			case "Esc":
				if (   Popups.popupContainerIsVisible()
					&& Popups.allSpawnedPopups().length > 0)
					Popups.despawnPopup(Popups.focusedPopup());
				break;
			case Popups.popupTilingControlKeys.substr(0,1):
				Popups.zoomPopup(Popups.focusedPopup(), "left");
				break;
			case Popups.popupTilingControlKeys.substr(1,1):
				Popups.zoomPopup(Popups.focusedPopup(), "bottom");
				break;
			case Popups.popupTilingControlKeys.substr(2,1):
				Popups.zoomPopup(Popups.focusedPopup(), "top");
				break;
			case Popups.popupTilingControlKeys.substr(3,1):
				Popups.zoomPopup(Popups.focusedPopup(), "right");
				break;
			case Popups.popupTilingControlKeys.substr(4,1):
				Popups.zoomPopup(Popups.focusedPopup(), "top-left");
				break;
			case Popups.popupTilingControlKeys.substr(5,1):
				Popups.zoomPopup(Popups.focusedPopup(), "top-right");
				break;
			case Popups.popupTilingControlKeys.substr(6,1):
				Popups.zoomPopup(Popups.focusedPopup(), "bottom-right");
				break;
			case Popups.popupTilingControlKeys.substr(7,1):
				Popups.zoomPopup(Popups.focusedPopup(), "bottom-left");
				break;
			case Popups.popupTilingControlKeys.substr(8,1):
				Popups.zoomPopup(Popups.focusedPopup(), "full");
				break;
			case Popups.popupTilingControlKeys.substr(9,1):
				Popups.pinOrUnpinPopup(Popups.focusedPopup());
				break;
			case Popups.popupTilingControlKeys.substr(10,1):
				Popups.collapseOrUncollapsePopup(Popups.focusedPopup());
				break;
			default:
				break;
		}
	}
};

GW.notificationCenter.fireEvent("Popups.didLoad");
