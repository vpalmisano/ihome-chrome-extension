/*
 *  Copyright (c) 2013 Vittorio Palmisano <vpalmisano@gmail.com>
 *
 *  This file is free software: you may copy, redistribute and/or modify it  
 *  under the terms of the GNU General Public License as published by the  
 *  Free Software Foundation, either version 2 of the License, or (at your  
 *  option) any later version.  
 *  
 *  This file is distributed in the hope that it will be useful, but  
 *  WITHOUT ANY WARRANTY; without even the implied warranty of  
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU  
 *  General Public License for more details.  
 *  
 *  You should have received a copy of the GNU General Public License  
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.  
 *
 */
var db = null
var options = {
    columns: 3,
    reload_t: 60*5
}

function dbError(t, e){
    console.log("db error", t, e)
}

function loadWidgets(){
    console.log('loadWidgets')
    db.transaction(function(tx){
        tx.executeSql('CREATE TABLE IF NOT EXISTS widgets ('
                +'id INTEGER PRIMARY KEY AUTOINCREMENT'
                +', url TEXT'
                +', type  TEXT'
                +', lastUpdate DATETIME'
                +', updateTime INTEGER DEFAULT(300)'
                +', position INTEGER DEFAULT(0)'
                +', column INTEGER DEFAULT(0)'
                +', max_posts INTEGER DEFAULT(5)'
                +')')
        tx.executeSql('SELECT * FROM widgets ORDER BY position ASC', [], function(tx, results){
            for(var i=0; i<results.rows.length; i++){
                loadWidgetData(results.rows.item(i))
            }
        })
    }, dbError)
}

function addWidget(url){
    db.transaction(function(tx){
        tx.executeSql('INSERT INTO widgets (url, type, lastUpdate) VALUES (?, ?, ?)', 
            [url, 'rss', 0], 
        function(tx, results){
            console.log('addWidget', results.insertId)
            loadWidget(results.insertId, function(item){
                loadWidgetData(item)
            })
        })
    }, dbError)
}

function editWidget(id, url, column, position, max_posts, callback){
    console.log('editWidget', id, url, column, max_posts)
    db.transaction(function(tx){
        tx.executeSql('UPDATE widgets SET url=?,column=?,position=?,max_posts=? WHERE id=?', 
            [url, column, position, max_posts, id], callback)
    }, dbError)
}

function deleteWidget(id){
    console.log('deleteWidget', id)
    db.transaction(function(tx){
        tx.executeSql('SELECT * FROM widgets WHERE id=?', [id], 
            function(tx, results){
                item = results.rows.item(0)
                tx.executeSql('DELETE FROM widgets WHERE id=?', 
                    [item.id], function(tx, results){
                    $('#widget-'+item.id).remove()
                })
        })
    }, dbError)
}

function updateWidgetLoadTime(id){
    //console.log('updateWidgetLoadTime', id)
    db.transaction(function(tx){
        tx.executeSql('UPDATE widgets SET lastUpdate=? WHERE id=?', [Date(), id])
    }, dbError)
}

function getWidget(id, callback){
    console.log('getWidget', id)
    db.transaction(function(tx){
        tx.executeSql('SELECT * FROM widgets WHERE id=?', [id], 
            function(tx, results){
                if(results.rows.length == 1){
                    callback(results.rows.item(0))
                }
        })
    }, dbError)
}

function loadWidget(id, callback){
    console.log('loadWidget', id)
    getWidget(id, function(item){
        loadWidgetData(item)
    })
}

function loadWidgetData(item){
    console.log('loadWidgetData', item.id)
    var widget_div = '#widget-'+item.id
    var div = $(widget_div)
    var container = $('#widgetsContainer'+item.column)
    if(div.length == 0){
        container.append('<div class="widget" id="widget-'+item.id+'" data-column="'+item.column+'" data-position="'+item.position+'">'
+' <div class="panel panel-default">'
+' <div class="panel-heading">'
+'  <img class="widget-loader" src="img/loader.gif" />'
+'  <strong><a class="feed-title" href="'+item.url+'" target="_blank">'+item.url.slice(0, 40)+'</a></strong>'
+'  <div class="btn-group pull-right">'
+'    <button class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown">'
+'      <span class="glyphicon glyphicon-wrench"></span>'
+'    </button>'
+'    <ul class="dropdown-menu" role="menu">'
+'      <li><a class="widget-edit" href="#">Edit</a></li>'
+'      <li><a class="widget-delete" href="#">Delete</a></li>'
+'    </ul>'
+'  </div>'
+' </div>'
+' <div class="panel-body" id="rss-content-'+item.id+'">'
+' </div>'
+' </div>'
+'</div>'
        )
        $(widget_div+' .widget-edit').click(function(e){
            editWidgetShowModal(item.id)
        })
        $(widget_div+' .widget-delete').click(function(e){
            deleteWidget(item.id)
        })
    }else{
        if(div[0].dataset.column != item.column){
            div[0].dataset.column = item.column
            div.detach()
            div.appendTo(container)
            reorderColumn(item.column)
        }
        if(div[0].dataset.position != item.position){
            div[0].dataset.position = item.position
            reorderColumn(item.column)
        }
    }
    loadFeedData(item)
}

function loadFeedData(item){
    console.log('loadFeedData', item.id)
    var widget_div = '#widget-'+item.id
    var rss_div = $('#rss-content-'+item.id)
    // avoid reload when posts are open
    var posts = rss_div.find('.list-group-item')
    if(posts.length > posts.children('.hide').length){
        scheduleReload(item.id)
        return
    }
    // reload rss
    $(widget_div+' img.widget-loader').removeClass('hide')
    rss_div.empty()
    rss_div.rss(item.url, {
        limit: item.max_posts,
        ssl: true,
        effect: 'show',
        layoutTemplate: '<ul class="list-group">{entries}</ul>',
        entryTemplate: '<li class="list-group-item">'
+'<div class="toggle-open"><span class="glyphicon glyphicon-chevron-right"></span>&nbsp{title}</div>'
+'<div class="hide feed-content">'
+'<em>{author}</em> <small>{date}</small> <a href="{url}" target="_blank"><span class="glyphicon glyphicon-link"></span></a> <div class="g-plusone" data-size="small" data-href="{url}"></div>'
+'<hr/>'
+'{body}'
+'</div>'
+'</li>',
        error: function(e){
            console.log('Error loading', item.id, e)
            $(widget_div+' img.widget-loader').addClass('hide')
            html = this.options.layoutTemplate.replace('{entries}', 
                '<li class="list-group-item"><em>Error loading feed</em></li>')
            this.target.append(html)
        }
    }, function(){
        $(widget_div+' img.widget-loader').addClass('hide')
        var title = $(widget_div+' a.feed-title')
        title.text(this.title)
        title[0].href = this.link
        updateWidgetLoadTime(item.id)
        gapi.plusone.go(widget_div)
        $(widget_div+' .toggle-open').click(function(e){
            var a = $(e.target)
            var span = a.children('span')
            var div = a.siblings('.feed-content')
            if(div.hasClass('hide')){
                div.removeClass('hide')
                span.removeClass('glyphicon-chevron-right')
                span.addClass('glyphicon-chevron-down')
            }else{
                div.addClass('hide')
                span.addClass('glyphicon-chevron-right')
                span.removeClass('glyphicon-chevron-down')
            }
        })
        scheduleReload(item.id)
    })
}

function scheduleReload(id){
    setTimeout(function(){ loadWidget(id); }, options.reload_t*1000)
}

function reorderColumn(column){
    console.log('reorderColumn', column)
    var container = $('#widgetsContainer'+column)
    var wlist = container.children()
    wlist.sort(function(w1, w2){
        return w1.dataset.position - w2.dataset.position
    })
    for(var i=0; i<wlist.length; i++){
        w = $(wlist[i])
        w.detach()
        w.appendTo(container)
    }
}

function editWidgetShowModal(id){
    getWidget(id, function(item){
        $('#editWidgetModalID')[0].value = item.id
        $('#editWidgetModalURL')[0].value = item.url
        $('#editWidgetModalColumn')[0].value = item.column
        $('#editWidgetModalPosition')[0].value = item.position
        $('#editWidgetModalMaxPosts')[0].value = item.max_posts
        $('#editWidgetModal').modal('show')
    })
}

function loadOptions(){
    if(localStorage['columns'])
        options.columns = localStorage['columns']
}

$(function(){
    loadOptions()
    for(var i=0; i<options.columns; i++){
        $('#rowContainer').append('<td class="column" id="widgetsContainer'+i+'"></td>')
    }
    // open db
    db = openDatabase('db', '0.1', 'iHome database', 2*1024*1024)
    loadWidgets()
    $('#addWidgetModalSave').click(function(e){
        var url = $('#addWidgetModalInput')[0].value
        addWidget(url)
        $('#addWidgetModalInput')[0].value = ''
        $('#addWidgetModal').modal('hide')
    })
    $('#editWidgetModalSave').click(function(e){
        var id = $('#editWidgetModalID')[0].value
        var url = $('#editWidgetModalURL')[0].value
        var column = $('#editWidgetModalColumn')[0].value
        var position = $('#editWidgetModalPosition')[0].value
        var max_posts = $('#editWidgetModalMaxPosts')[0].value
        editWidget(id, url, column, position, max_posts, function(){
            $('#editWidgetModalID')[0].value = ''
            $('#editWidgetModalURL')[0].value = ''
            $('#editWidgetModalColumn')[0].value = 0
            $('#editWidgetModalPosition')[0].value = 0
            $('#editWidgetModalMaxPosts')[0].value = 0
            $('#editWidgetModal').modal('hide')
            loadWidget(id)
        })
    })

})
