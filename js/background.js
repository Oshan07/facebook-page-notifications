var fc = {
    baseUrlWeb: "https://www.facebook.com",
    baseUrlMobile: "https://m.facebook.com",
    postLinkPattern : /ajaxify="([^\s]*)"/g,
    pages: {},
    activePages: {},
    maxPostLinkHistory: 20,
    unreadNotifications : {},
    saveData : function(data, callback) {
        chrome.storage.sync.set(data, callback);
    },
    retrieveData: function (keyName, callback) {
        chrome.storage.sync.get(keyName, callback);
    },
    savePage: function (page) {
        if(this.pages[page.id]) {
            this.stopActivePage(page.id);
            page.postLinkHistory = this.pages[page.id].postLinkHistory;
        }
        this.pages[page.id] = page;
        this.saveData({"pages": this.pages});
        if(page.enabled) {
            this.activatePageCheck(page);
        }
    },
    deletePage: function (pageId) {
        this.stopActivePage(pageId);
        delete this.pages[pageId];
        this.saveData({"pages": this.pages});
    },
    getPageList: function () {
        return this.pages;
    },
    removeOldPostLinks: function (page) {
        var itemCountToRemove = page.postLinkHistory.length - this.maxPostLinkHistory;
        if(itemCountToRemove > 0) {
            page.postLinkHistory.splice(0, itemCountToRemove);
        }
    },
    activatePageCheck: function (page) {
        if(!page.enabled || page.id == "") {return }
        if (this.pages[page.id] && this.pages[page.id].intervalId) {
            clearInterval(this.pages[page.id].intervalId);
        }
        this.activePages[page.id] = page;
        this.pages[page.id].intervalId = setInterval(function () {
            page.updatePostLinks();
        }, page.postsCheckInterval);
    },
    showNotification: function (notificationId, page) {
        var opt = {
            type: "basic",
            title: "Notification",
            message: page.name + " posted!",
            iconUrl: page.profilePic
        };
        chrome.notifications.create(notificationId, opt);
    },
    stopAllActivePages : function () {
        var self = this;
        var activePageIds = Object.keys(self.activePages);
        activePageIds.forEach(function (activePageId) {
          self.stopActivePage(activePageId);
        });
    },
    stopActivePage: function (activePageId) {
        if(!this.activePages[activePageId]) {return}
        clearInterval(this.activePages[activePageId].intervalId);
        delete this.activePages[activePageId];
    },
    reloadPageSettings: function () {
        var self = this;
        var pageIds;
        var page;
        self.pages = {};
        self.stopAllActivePages();
        this.retrieveData("pages", function (data) {
            delete data.pages[""];
            pageIds = Object.keys(data.pages);
            pageIds.forEach(function (pageId) {
                page = new Page(data.pages[pageId]);
                self.pages[pageId] = page;
                self.activatePageCheck(page);
            });
        });
    },
    getUnreadNotifications : function () {
      return this.unreadNotifications;  
    },
    getCurrentDateTime: function () {
        var d = new Date();
        return {
            time: d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds(),
            date: d.getFullYear() + "-" + parseInt(d.getMonth() + 1) + "-" + d.getDate()
        }
    },
    createNewNotification : function (url, page) {
        this.showNotification(url, page);
        this.unreadNotifications[url] = {
            url: url,
            pageName: page.name,
            profilePic: page.profilePic,
            dateTime: this.getCurrentDateTime()
        };
    },
    markNotificationAsRead : function (notificationId) {
        delete fc.unreadNotifications[notificationId];
        fc.updateBadge(Object.keys(fc.unreadNotifications).length.toString());
    },
    clearAllNotifications: function () {
        this.unreadNotifications = {};
        this.updateBadge("0");
        return {"done":true};
    },
    updateBadge: function (count) {
        if(count == '0') {count = ''}
        chrome.browserAction.setBadgeText({text: count});
    },
    init: function () {
        this.reloadPageSettings();
    }
};

/*fc.getRandomInt = function (min, max) {
    return parseInt(Math.random() * (max - min) + min);
};*/

function Page(options) {
    this.name = options.name || "";
    this.id = options.id || "";
    this.postsCheckInterval = options.postsCheckInterval || "";
    this.mobileVersionEnabled = options.mobileVersionEnabled == "undefined" ?   true : options.mobileVersionEnabled;
    this.profilePic = options.profilePic || "../images/notification_48.png",
    this.enabled = options.enabled || false;
    this.postLinks = options.postLinks || [];
    this.postLinkHistory = options.postLinkHistory || [];
    this.pageURL = this.getPageURL();
    this.postsURL = this.getPostsURL();
    this.updatePostLinks = this.mobileVersionEnabled ? this.updatePostLinksMobile : this.updatePostLinksWeb;
}

Page.prototype.getPostsURL = function () {
    return this.mobileVersionEnabled ? fc.baseUrlMobile + "/pg/" + this.id + "/posts/?ref=page_internal&mt_nav=1" : fc.baseUrlWeb + "/pg/" + this.id +"/posts/?ref=page_internal";
};

Page.prototype.getPageURL = function () {
    return this.mobileVersionEnabled ? fc.baseUrlMobile +"/"+ this.id : fc.baseUrlWeb+"/"+this.id;
};

Page.prototype.updatePostLinksMobile = function () {
    var self = this;
    $.get(self.postsURL, function (data) {
        var linkElements = $(data).find("div[data-sigil='m-feed-voice-subtitle']").find("a");
        var linkElementCount = linkElements.length;
        self.postLinks = [];
        for(var i=0; i< linkElementCount; i++){
            self.postLinks.push(fc.baseUrlMobile+$(linkElements[i]).attr("href"));
        }
        self.lookForNewPosts();
    });
};

Page.prototype.updatePostLinksWeb = function (callback) {
    var self = this;
    var match, postURL, link;
    $.get(self.getPostsURL(), function (data) {
        self.postLinks = [];
        while(match = fc.postLinkPattern.exec(data)) {
            postURL = match[1];
            link = fc.baseUrlWeb + postURL;
            link = link.split("?")[0];
            if(link.indexOf(self.id) > -1) {
                self.postLinks.push(link);
            }
        }
        self.lookForNewPosts();
    });
};

Page.prototype.setMobileVersionEnabled = function (enabled) {
    this.mobileVersionEnabled = enabled;
    this.postsURL = this.getPostsURL();
    this.pageURL = this.getPageURL();
    this.updatePostLinks = this.mobileVersionEnabled ? this.updatePostLinksMobile : this.updatePostLinksWeb;
};

Page.prototype.lookForNewPosts = function () {
    var self = this;
    var hasNewPosts = false;
    self.postLinks.forEach(function (postLink) {
        if (self.postLinkHistory.indexOf(postLink) == -1) {
            fc.createNewNotification(postLink, self);
            self.postLinkHistory.push(postLink);
            hasNewPosts = true;
        }
    });
    if(hasNewPosts) {
        fc.removeOldPostLinks(self);
        fc.pages[self.id] = self;
        fc.saveData({"pages": fc.pages});
        fc.updateBadge(Object.keys(fc.unreadNotifications).length.toString());
    }
};

chrome.runtime.onInstalled.addListener(function () {
    var settings = {
        postsCheckInterval : 3000
    };
    fc.saveData({"pages": fc.pages});
    fc.saveData({"settings": settings});
});

chrome.notifications.onClicked.addListener(function (notificationId) {
    fc.markNotificationAsRead(notificationId);
    window.open(notificationId, '_blank');
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.message) {
        case "get-unread-notifications":
            sendResponse(fc.getUnreadNotifications());
            break;
        case "mark-as-read":
            fc.markNotificationAsRead(request.notificationId);
            break;
        case "clear-all-notifications":
            sendResponse(fc.clearAllNotifications());
            break;
        case "reload-page-settings":
            fc.reloadPageSettings();
            break;
        case "save-page":
            fc.savePage(new Page(request.page));
            setTimeout(function () {
                sendResponse({saved: true});
            },200);
            break;
        case "delete-page":
            fc.deletePage(request.pageId);
            setTimeout(function () {
                sendResponse({deleted: true});
            },200);
            break;
        case "get-page-list":
            sendResponse(fc.getPageList());
            break;
    }
});

fc.init();