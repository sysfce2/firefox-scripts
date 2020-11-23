// ==UserScript==
// @name            Mouse Gestures
// @author          xiaoxiaoflood
// @include         main
// @shutdown        win.MGest.destroy();
// ==/UserScript==

// initially forked from http://www.cnblogs.com/ziyunfei/archive/2011/12/15/2289504.html

window.MGest = {
  init: function () {
    MGest.utils.init();
    messageManager.loadFrameScript(MGest.utils.frameScript, true);
    messageManager.addMessageListener('contentToChrome', MGest.utils.chromeListener);
  },
  destroy: function () {
    messageManager.broadcastAsyncMessage('chromeToContent', 'destroy');
    messageManager.removeDelayedFrameScript(MGest.utils.frameScript);
    messageManager.removeMessageListener('contentToChrome', MGest.utils.chromeListener);
    MGest.utils.destroy();
    delete MGest;
  },
  utils: {
    init: function () {
      var self = this;
      ['mousedown', 'mouseup', 'contextmenu', 'drop', 'click'].forEach(function (type) {
        document.addEventListener(type, self, true);
      });
      document.addEventListener('wheel', self, { passive: false, capture: true });
      ['mouseleave', 'mousemove'].forEach(function (type) {
        document.addEventListener(type, self, false);
      });
      self.orig_selected = Object.getOwnPropertyDescriptor(customElements.get('tabbrowser-tab').prototype, '_selected').set;
      Object.defineProperty(customElements.get('tabbrowser-tab').prototype, '_selected', {
        set: function (val) {
          if (val && !this.everSelected)
            this.everSelected = true;

          return self.orig_selected.call(this, val);
        }
      });
    },
    destroy: function () {
      var self = this;
      ['mousedown', 'wheel', 'mouseup', 'contextmenu', 'drop', 'click'].forEach(function (type) {
        document.removeEventListener(type, self, true);
      });
      ['mouseleave', 'mousemove'].forEach(function (type) {
        document.removeEventListener(type, self, false);
      });
      Object.defineProperty(customElements.get('tabbrowser-tab').prototype, '_selected', {
        set: this.orig_selected,
        configurable: true
      });
    },
    chromeListener: function (message) {
      if (message.data.cmd) {
        if (message.data.cmd == 'scroll-up') {
          document.commandDispatcher.getControllerForCommand('cmd_moveTop').doCommand('cmd_moveTop');
        } else if(message.data.cmd == 'scroll-down') {
          document.commandDispatcher.getControllerForCommand('cmd_moveBottom').doCommand('cmd_moveBottom');
        }
      } else if (message.data.url) {
        gBrowser.addTab(message.data.url, {owner: gBrowser.selectedTab, relatedToCurrent: true, triggeringPrincipal: gBrowser.selectedBrowser.contentPrincipal});
      }
    },
    frameScript: 'data:application/javascript;charset=UTF-8,' + 
      encodeURIComponent('(' + (function () {
        let clickedElement;
        var imgSrc = function (e) {
          clickedElement = e.target;
          if (clickedElement.src) {
            img = clickedElement.src;
          } else if (clickedElement.tagName == 'AREA') {
            let uM = clickedElement.ownerDocument.querySelector('[usemap]');
            if (uM && uM.useMap == '#' + clickedElement.parentElement.name) {
              img = uM.src;
            } else {
              img = undefined;
            }
          } else {
            img = undefined;
          }
        }
        addEventListener('mousedown', imgSrc, true);
        contentListener = function (msg) {
          if (msg.data == 'img' && typeof img != 'undefined') {
            sendAsyncMessage('contentToChrome', {url: img});
          } else if (msg.data == 'down' && typeof img != 'undefined') {
              sendAsyncMessage('contentToChrome', {url: 'http://www.google.com.br/searchbyimage?image_url=' + encodeURIComponent(img)});
          } else if (msg.data == 'down' || msg.data == 'up') {
            clickedElement.tabIndex = -1;
            clickedElement.focus();
            sendAsyncMessage('contentToChrome', {cmd: 'scroll-' + msg.data});
          } else if (msg.data == 'deselect') {
            content.getSelection().removeAllRanges();
          } else if (msg.data == 'destroy') {
            removeEventListener('mousedown', imgSrc);
            removeMessageListener('chromeToContent', contentListener);
            delete imgSrc;
            delete contentListener;
          }
        }
        addMessageListener('chromeToContent', contentListener);
      }).toString() + ')();'),
    lastX: 0,
    lastY: 0,
    directionChain: '',
    isMouseDownL: false,
    isMouseDownM: false,
    isMouseDownR: false,
    isMouseUpL: false,
    isMouseUpM: false,
    isMouseUpR: false,
    isRelatedL: false,
    isRelatedM: false,
    isRelatedR: false,
    hideFireContext: false,
    GESTURES: {
      '1-': {
        name: 'Zoom in',
        cmd: function () {
          FullZoom.enlarge();
        }
      },
      '1+': {
        name: 'Zoom out',
        cmd: function () {
          FullZoom.reduce();
        }
      },
      'R': {
        name: 'Open image URL',
        cmd: function () {
          gBrowser.selectedBrowser.messageManager.sendAsyncMessage('chromeToContent', 'img');
        }
      },
      'M>L': {
        name: 'Zoom reset',
        cmd: function () {
          FullZoom.reset();
        }
      },
      'R>L': {
        name: 'Switch to last selected tab',
        cmd: function () {
          let previousTab = gBrowser.selectedTab;
          let lastAccessed  = 0;
          for (let tab of gBrowser.tabs) {
            if (tab.everSelected && tab._lastAccessed > lastAccessed && tab != gBrowser.selectedTab) {
              lastAccessed = tab._lastAccessed;
              previousTab = tab;
            }
          }
          gBrowser.selectedTab = previousTab;
        }
      },
      'L>M': {
        name: 'Duplicate tab',
        cmd: function () {
          gBrowser.selectedTab = gBrowser.duplicateTab(gBrowser.selectedTab);
        }
      },
      '2+': {
        name: 'Next tab',
        cmd: function () {
          gBrowser.tabContainer.advanceSelectedTab(1, true);
        }
      },
      '2-': {
        name: 'Previous tab',
        cmd: function () {
          gBrowser.tabContainer.advanceSelectedTab(-1, true);
        }
      },
      'L>R': {
        name: 'Reload current tab',
        cmd: function () {
          openLinkIn(gBrowser.currentURI.spec, 'current', {allowThirdPartyFixup: true, targetBrowser: gBrowser.selectedBrowser, indicateErrorPageLoad: true, allowPinnedTabHostChange: true, disallowInheritPrincipal: true, allowPopups: false, triggeringPrincipal: gBrowser.selectedBrowser.contentPrincipal});
        }
      },
      'R>M': {
        name: 'Close current tab',
        cmd: function () {
          gBrowser.removeCurrentTab();
        }
      },
      'U': {
        name: 'Go to top of page (strict)',
        cmd: function () {
          gBrowser.selectedBrowser.messageManager.sendAsyncMessage('chromeToContent', 'up');
        }
      },
      'D': {
        name: 'Go to bottom of page (strict) / Image search',
        cmd: function () {
          gBrowser.selectedBrowser.messageManager.sendAsyncMessage('chromeToContent', 'down');
        }
      }
    },
    handleEvent: function (event) {
      switch (event.type) {
      case 'mousedown':
        //if(/object|embed/i.test(event.target.localName)) return;
        if (event.button == 2) {
          if (this.isMouseUpR) {
            this.isMouseUpR = false;
          }
          this.hideFireContext = false;
          [this.lastX, this.lastY, this.directionChain] = [event.screenX, event.screenY, ''];
          if (this.isMouseDownL) {
            this.hideFireContext = true;
            this.isRelatedL = true;
            this.isRelatedR = true;
            this.stopGesture(event, 'L>R');
            event.preventDefault();
            event.stopPropagation();
          } else if (this.isMouseDownM) {
            this.hideFireContext = true;
            this.isRelatedM = true;
            this.isRelatedR = true;
            this.stopGesture(event, 'M>R');
            event.preventDefault();
            event.stopPropagation();
          } else {
            this.isMouseDownR = true;
          }
        } else if (event.button == 0) {
          if (this.isMouseUpL) {
            this.isMouseUpL = false;
          }
          if (this.isMouseDownR) {
            this.hideFireContext = true;
            this.directionChain = '';
            this.isRelatedR = true;
            this.isRelatedL = true;
            this.stopGesture(event, 'R>L');
            event.preventDefault();
            event.stopPropagation();
          } else if (this.isMouseDownM) {
            this.hideFireContext = true;
            this.isRelatedM = true;
            this.isRelatedL = true;
            this.stopGesture(event, 'M>L');
            event.preventDefault();
            event.stopPropagation();
          } else {
            this.isMouseDownL = true;
          }
        } else if (event.button == 1) {
          if (this.isMouseUpM) {
            this.isMouseUpM = false;
          }
          if (this.isMouseDownR) {
            this.hideFireContext = true;
            this.directionChain = '';
            this.isRelatedR = true;
            this.isRelatedM = true;
            this.stopGesture(event, 'R>M');
            event.preventDefault();
            event.stopPropagation();
          } else if (this.isMouseDownL) {
            this.hideFireContext = true;
            this.isRelatedL = true;
            this.isRelatedM = true;
            this.stopGesture(event, 'L>M');
            event.preventDefault();
            event.stopPropagation();
          } else {
            this.isMouseDownM = true;
          }
        }
        break;
      case 'mousemove':
        if (this.isMouseDownR) {
          this.hideFireContext = true;
          var [subX, subY] = [event.screenX - this.lastX, event.screenY - this.lastY];
          var [distX, distY] = [(subX > 0 ? subX : (-subX)), (subY > 0 ? subY : (-subY))];
          var direction;
          if (distX < 10 && distY < 10) return;
          if (distX > distY) direction = subX < 0 ? 'L' : 'R';
          else direction = subY < 0 ? 'U' : 'D';
          if (direction != this.directionChain.charAt(this.directionChain.length - 1)) {
            this.directionChain += direction;
          }
          this.lastX = event.screenX;
          this.lastY = event.screenY;
        }
        if (this.isMouseDownL) {
          this.isMouseDownL = false;
        }
        if (this.isMouseDownM) {
          this.isMouseDownM = false;
        }
        break;
      case 'mouseup':
        if (event.ctrlKey && event.button == 2) {
          this.isMouseDownR = false;
          this.hideFireContext = false;
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.button == 2) {
          if (this.isMouseDownR) {
            this.isMouseDownR = false;
          }
          if (this.isRelatedR) {
            this.isMouseUpR = true;
            this.isRelatedR = false;
            event.preventDefault();
            event.stopPropagation();
          }
          if (this.directionChain) {
            this.stopGesture(event, this.directionChain);
          }
        } else if (event.button == 0) {
          if (this.isMouseDownL) {
            this.isMouseDownL = false;
          }
          if (this.isRelatedL/* && event.target.tagName != 'OBJECT'*/) {
            this.isMouseUpL = true;
            this.isRelatedL = false;
            gBrowser.selectedBrowser.messageManager.sendAsyncMessage('chromeToContent', 'deselect');
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.button == 1) {
          if (this.isMouseDownM) {
            this.isMouseDownM = false;
          }
          if (this.isRelatedM) {
            this.isMouseUpM = true;
            this.isRelatedM = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }
        break;
      case 'click':
        if (event.button == 2) {
          if (this.isMouseUpR) {
            this.isMouseUpR = false;
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.button == 0) {
          if (this.isMouseUpL) {
            this.isMouseUpL = false;
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.button == 1) {
          if (this.isMouseUpM) {
            this.isMouseUpM = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }
        break;
      case 'contextmenu':
        if (this.isMouseDownL || this.isMouseDownR || this.isMouseDownM || this.hideFireContext) {
          event.preventDefault();
          event.stopPropagation();
          this.hideFireContext = false;
        }
        break;
      case 'wheel':
        if (this.isMouseDownR) {
          event.preventDefault();
          event.stopPropagation();
          this.hideFireContext = true;
          this.directionChain = '';
          this.isRelatedR = true;
          this.stopGesture(event, '2' + (event.deltaY > 0 ? '+' : '-'));
        } else if (this.isMouseDownL) {
          event.preventDefault();
          event.stopPropagation();
          this.isRelatedL = true;
          this.stopGesture(event, '0' + (event.deltaY > 0 ? '+' : '-'));
        } else if (this.isMouseDownM) {
          event.preventDefault();
          event.stopPropagation();
          if (gBrowser.getBrowserForTab(gBrowser._selectedTab)._autoScrollPopup && gBrowser.getBrowserForTab(gBrowser._selectedTab)._autoScrollPopup.state == 'open')
            gBrowser.getBrowserForTab(gBrowser._selectedTab)._autoScrollPopup.hidePopup();
          this.isRelatedM = true;
          this.stopGesture(event, '1' + (event.deltaY > 0 ? '+' : '-'));
        }
        break;
      case 'mouseleave':
        if (this.isMouseDownL)
          this.isMouseDownL = false;
        if (this.isMouseDownM)
          this.isMouseDownM = false;
        if (this.isMouseDownR) {
          this.isMouseDownR = false;
          this.directionChain = '';
        }
        break;
      case 'drop':
        this.isMouseDownL = false;
      }
    },
    stopGesture: function (event, gst) {
      if (this.GESTURES[gst]) {
        this.GESTURES[gst].cmd(this, event);
      }
    }
  }
};

MGest.init();