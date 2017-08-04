/**
 * Created by Oshan on 3/22/2017.
 */
var pageListTable;

var updatePageList = function() {
    sendMessage({message:"get-page-list"}, function (pageList) {
        pageListTable.clear().draw();
        var pageIds = Object.keys(pageList).reverse();
        pageIds.forEach(function (pageId) {
            addNewRow(pageList[pageId]);
        });
    });
};

var deletePage = function(pageId) {
    sendMessage({message:"delete-page", pageId: pageId}, function (response) {
        updatePageList();
    });
};

var displayAlert = function(type, message) {
    alert(type+": "+message);
};

var scrapePageDataMobile = function(data) {
    var profilePicData = JSON.parse(/{"editable".+usernameEditDialogProfilePictureURI.*?}/.exec(data)[0]);
    var name = profilePicData.name;
    var id = profilePicData.username;
    console.log(profilePicData);
    return {
        name: name,
        id: id,
        profilePic: profilePicData.usernameEditDialogProfilePictureURI,
        enabled: false,
        postsCheckInterval: 3000,
        mobileVersionEnabled: false
    };
};

var addNewRow = function(page) {
    pageListTable.row.add(page).draw();
};

var sendMessage = function(message, callback) {
    chrome.runtime.sendMessage(message, callback);
};

$(document).ready(function () {
    var body = $("body");
    pageListTable = $('#page-list').DataTable({
        "lengthMenu": [ 5, 10 ],
        "pagingType": "simple",
        "aaSorting": [],
        "columnDefs": [
            {
                "orderable": false,
                "data": "profilePic",
                "render": function(data, type, full, meta) {
                    return "<img class='profile-pic' src ='"+data+"'>";
                },
                "targets": 0
            },
            {
                "width": "30%",
                "data": "name",
                "targets": 1
            },
            {   "data": "id",
                "targets": 2
            },
            {   "data": null,
                "orderable": false,
                "render": function(data, type, full, meta) {
                    var statusStr = data.mobileVersionEnabled ? "checked" : "";
                    return "<input type='checkbox' "+ statusStr + " data-toggle='toggle' class='toggle-switch sw-mv' data-size='mini' class='btn-mv' data-page-id='"+data.id+"'>";
                },
                "targets": 3
            },
            {   "data": null,
                "orderable": false,
                "render": function(data, type, full, meta) {
                    var statusStr = data.enabled ? "checked" : "";
                    return "<input type='checkbox' "+ statusStr + " data-toggle='toggle' class='toggle-switch sw-notifications' data-size='mini' class='btn-enabled' data-page-id='"+data.id+"'>";
                },
                "targets": 4
            },
            {
                "data": "id",
                "orderable": false,
                "width": "20%",
                "className": "actions",
                "render": function(pageId, type, full, meta) {
                    return "<a href='#' class='delete pull-right' title='Delete Page' data-page-id='"+pageId+"'><span class='glyphicon glyphicon-trash'></span></a>    <a href='#' class='edit pull-right' title='Edit Page' data-page-id='"+pageId+"'><span class='glyphicon glyphicon-edit'></span></a>";
                },
                "targets": 5
            }
        ]
    });
    $('#add-page-form').submit(function (evt) {
        var page;
        var loadingGif = $("#loading-gif");
        var pageUrlInput = $("#page-url");
        var pageURL = pageUrlInput.val();
        evt.preventDefault();
        loadingGif.removeClass("hide");
        $.get(pageURL, function (data) {
            try{
                page = scrapePageDataMobile(data);
                sendMessage({message:"save-page", page: page}, function (response) {
                    updatePageList();
                    pageUrlInput.val('');
                    loadingGif.addClass("hide");
                });
            } catch(e){
                console.log(e);
                displayAlert("ERROR", "Invalid page URL!");
            }
        });
    });

    body.on('click', ".edit", function() {
        var page = pageListTable.row((this).closest("tr")).data();
        var editForm = $("#edit-form");
        editForm
            .find('[name="id"]').val(page.id).end()
            .find('[name="name"]').val(page.name).end()
            .find('[name="profile-pic"]').val(page.profilePic).end()
            .find('[name="posts-check-interval"]').val(page.postsCheckInterval).end()
            .find('[name="mobile-version"]').prop('checked', page.mobileVersionEnabled).end()
            .find('[name="enabled"]').prop('checked', page.enabled).end();

        bootbox
            .dialog({
                title: 'Edit the page details',
                message: editForm,
                show: false
            })
            .on('shown.bs.modal', function() {
                $("#edit-form")
                    .show();
            })
            .on('hide.bs.modal', function(e) {
                $("#edit-form").hide().appendTo('body');
            })
            .modal('show');
    });

    $(".edit-form-checkbox").bootstrapToggle();

    $("#edit-form").on('submit', function(e) {
        e.preventDefault();
        var form = $(this);
        var page = {
            name: form.find('[name="name"]').val(),
            id: form.find('[name="id"]').val(),
            profilePic: form.find('[name="profile-pic"]').val(),
            enabled: form.find('[name="enabled"]').is(":checked"),
            mobileVersionEnabled: form.find('[name="mobile-version"]').is(":checked"),
            postsCheckInterval: parseInt(form.find('[name="posts-check-interval"]').val())
        };
        sendMessage({message:"save-page", page: page}, function (response) {
            updatePageList();
        });
        bootbox.hideAll();
    });

    pageListTable.on('draw', function () {
        $(".toggle-switch").bootstrapToggle();
    });

    body.on("click", ".delete", function (event) {
        if(confirm("Are you sure you want to delete this page? ")){
            deletePage($(this).attr("data-page-id"));
        }
        event.preventDefault();
    });
    body.on("change", ".toggle-switch.sw-mv", function () {
        var page = pageListTable.row((this).closest("tr")).data();
        page.mobileVersionEnabled = this.checked;
        sendMessage({message: "save-page", page: page});
    });
    body.on("change", ".toggle-switch.sw-notifications", function () {
        var page = pageListTable.row((this).closest("tr")).data();
        page.enabled = this.checked;
        sendMessage({message: "save-page", page: page});
    });
    updatePageList();
});

