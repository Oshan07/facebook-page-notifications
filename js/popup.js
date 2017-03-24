$(document).ready(function () {
    var notifications =[];
    var itemsPerPage = 5;
    var pageCount;
    sendMessage({"message":"get-unread-notifications"}, function (response) {
        var notificationUrls = Object.keys(response);
        var i = notificationUrls.length;
        while(i) {
            notifications.push(response[notificationUrls[i-1]]);
            i--;
        }
        pageCount = Math.floor(notifications.length/itemsPerPage);
        pageCount = (notifications.length%itemsPerPage) > 0 ? pageCount+1 : pageCount;
        $("#pagination").bootpag({
            total: notifications.length == 0 ? 0: pageCount,
            page: 1,
            maxVisible: pageCount > 1 ? 2 : 1,
            leaps: true,
            href: "#result-page-{{number}}"
        });
        if(notifications.length == 0) {
            sendMessage({message:"get-page-list"}, function (pageList) {
               if(Object.keys(pageList).length == 0) {
                   $("#info").removeClass("hide");
               } else {
                   $("#info").html("All notifications were caught up!").removeClass("hide");
               }
            });
            return
        }
        updateListGroup(notifications.slice(0,itemsPerPage));
    });

    $("#pagination").on("page", function (event, num) {
        var startIndex = (parseInt(num) -1)* itemsPerPage;
        updateListGroup(notifications.slice(startIndex, itemsPerPage + startIndex));
    });
    
    $(".clear-all").click(function () {
       sendMessage({message:"clear-all-notifications"}, function (response) {
          window.location.reload();
       });
    });
});

function updateListGroup(notifications) {
    var listGroup = $(".list-group");
    listGroup.html("");
    notifications.forEach(function (notification) {
        listGroup.append(createListItem(notification));
    });
    setTimeout(function () {
        $("body").on("click", ".notification", function () {
            sendMessage({message: "mark-as-read", notificationId: this.href}, function () {
            });
        });
    }, 200);
}

function createListItem(notification) {
    return $("<a href='"+notification.url+"'  target='_blank' class='list-group-item notification'>\
        <div class='row'>\
            <div class='col-xs-2 profile-pic vcenter'>\
                <img src='"+notification.profilePic+"'>\
            </div>\
            <div class='col-xs-9 notification-description vcenter'>\
                <b> "+notification.pageName+"</b> added a new post\
            </div>\
        </div>\
        </a>");
}

function sendMessage(message, callback) {
    chrome.runtime.sendMessage(message, callback);
}



