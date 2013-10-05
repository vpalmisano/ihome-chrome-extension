/*
 * Copyright (c) 2013 Vittorio Palmisano <vpalmisano@gmail.com>
 */
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.query({
        "url": chrome.extension.getURL("/index.html")
    }, function(res){
        if(res.length == 0){
            chrome.tabs.create({
                "index": 0,
                "url": chrome.extension.getURL("/index.html"),
                "active": true,
                "pinned": true
            });
        }else{
            chrome.tabs.update(res[0].id, {
                "active": true,
                "pinned": true,
                "highlighted": true
            });
        }
    });
});
