$.cookie.json = true;

feedbacklink = "https://docs.google.com/forms/d/e/1FAIpQLSePzS9pb_YugkDTr9k6NFjuGt1BQdZi-hZA0x5PjZ3QC_1RQQ/viewform?usp=pp_url&entry.814020263="

$(function() {
    $.ajax({
        type: "get",
        url: "episode_index.json",
        success: response => {
            gotIndex(response)
        }
    });

    $("#maxbutton").click(() => {
        $("#player").addClass("maximized")
    })
    $("#minbutton").click(() => {
        $("#player").removeClass("maximized")
    })
    $("#sidebaropenbutton").click(() => {
        $("body").addClass("sidebaropen")
    })
    $("#sidebarclosebutton").click(() => {
        $("body").removeClass("sidebaropen")
    })
})

function gotIndex(response) {
    window.index = response
    window.eps = {}
    index.episodes.forEach(ep => {
        eps[ep.slug] = ep
    })

    window.tagcats = {}

    // Sidebar
    Object.keys(index.categories).forEach(tagcat => {
        index.categories[tagcat].forEach(tag => {
            window.tagcats[tag] = tagcat
            if (index.tags[tag]) {
                $("#tags_" + tagcat.replace(/[^a-z0-9]/g, "")).append($(`<li><a href='?tag=${tag}'>${index.tagnames[tag]}</a></li> `))
            }
        })
    })

    $(".sidebar ul a").click((ev) => {
        if (!ev.ctrlKey && !ev.metaKey) {
            ev.preventDefault()
            history.pushState({},"",ev.target.href)
            runQuery()
        }
    })


    window.onpopstate = runQuery

    let nowplaying = $.cookie("nowplaying")
    if (nowplaying) {
        console.log("Resuming " + nowplaying)
        playEpisode(nowplaying, false, $.cookie("nowplaying_time"))
    }

    runQuery()
}

function runQuery() {
    window.query = {}
    location.search.slice(1).split("&").forEach(x => {
        y = x.split("=")
        query[y[0]] = y[1]
    })

    $("#main").text("")

    if (query.tag) {
        $("#main").append($("<h1>").text(index.tagnames[query.tag]))
        index.tags[query.tag].forEach(epslug => {
            ep = window.eps[epslug]
            if (ep) {
                $("#main").append(epSummary(ep))
            }
        })
    }
    else if (query.episode) {
        if (eps[query.episode]) {
            $("#main").append(epSummary(eps[query.episode]))
            playEpisode(query.episode)
        }
        else {
            $("#main").append("Story not found")
        }
    }
    else if (query.page) {
        $.ajax({
            type: "get",
            url: "static/" + query.page + ".html",
            success: response => {
                $("#main").html(response)
            }
        })
    }
    else if (query.search != undefined) {
        $.ajax({
            type: "get",
            url: "search_index.json",
            success: response => {
                window.searchindex = response
                search()
            }
        });
        $("#main").append($(`
            <h1>Search results for '<span id='searchname'></span>'</h1>
            <div id='searchresults'></div>
        `))
        $("#searchbox")[0].value = query.search
        search()
    }
    else {
        $("#main").append($("<h1>Latest story</h1>"))
        $("#main").append(epSummary(index.episodes[0]))
        $("#main").append($("<h1>More recent stories</h1>"))
        index.episodes.slice(1).forEach((ep) => {
            $("#main").append(epSummary(ep))
        })
    }
    $("body").scrollTop(0)
    $("body").removeClass("sidebaropen")

    $("#feedbacklink").attr("href", feedbacklink)
}

function tagName(x) {
    return index.tagnames[x] || x
}

tagsort = {
    "event": 0,
    "plot": 10,
    "setting": 20,
    "mood": 30,
    "content": 35,
    "by": 40,
    "narrator": 50,
}

function search() {
    $("#searchname").text($("#searchbox")[0].value)
    q = $("#searchbox")[0].value.toLowerCase()
    if (query.search == undefined) {
        openSearch()
        return
    }
    history.replaceState({},"", "?search=" + escape(q))
    var words = q.split(" ")
    words = words.concat(words.map(stemmer))
    if (window.searchindex) {
        let scores = {}
        words.forEach((w) => {
            let res = searchindex.words[w]
            if (res) {
                Object.keys(res).forEach((k) => {
                    scores[k] = (scores[k] ?? 0) + res[k]
                })
            }
        })
        $("#searchresults").html("")
        Object.keys(scores).sort((a,b) => {return scores[b] - scores[a]}).forEach((sk) => {
            let slug = searchindex.slugs[sk]
            let ep = eps[slug]
            if (ep) {
                $("#searchresults").append(epSummary(ep))
            }
        })
    }
    else {
        $("#searchresults").text("Loading...")
    }
}

dateformatter = Intl.DateTimeFormat(undefined, { "dateStyle": "full" })

function epSummary(ep) {
    let el = $("<div class='epsummary'>")
    el.append(
        $("<span class='playbutton'>")
        .text("▶︎")
        .click((ev) => { 
            if (ev.ctrlKey || ev.metaKey) {
                return true;
            }
            else {
                playEpisode(ep.slug) 
                ev.preventDefault();
            }
        })
    )
    el.append(
        $(`<h2><a href='?episode=${ep.slug}'>${ep.title}</a></h2>`)
        .click((ev) => { 
            if (ev.ctrlKey || ev.metaKey) {
                return true;
            }
            else {
                playEpisode(ep.slug) 
                ev.preventDefault()
            }
        })
    )
    el.append($(`<span class='pubdate'>${dateformatter.format(new Date(ep.published_date))}</span>`))
    if (ep.tags) {
        let tags = $("<ul class='showtags'>")
        ep.tags.sort((a,b) => { return (tagsort[tagcats[a]] ?? 100) - (tagsort[tagcats[b]] ?? 100)}).forEach(tag => {
            if (tag == 'check-tags') return;
            let tagcat = tagcats[tag]
            if (tagcat != 'warning') {
                tags.append($(`<li class='tag_${tagcat}'><a href='?tag=${tag}'>${tagName(tag)}</a> </li>'`))
            }
        });
        tags.find("a").click((ev) => {
            if (!ev.ctrlKey && !ev.metaKey) {
                ev.preventDefault()
                history.pushState({},"",ev.target.href)
                runQuery()
            }
        })
        el.append(tags)
    }
    el.append($("<div class='shownotes'>").html(ep.shownotes.replace(/\{\{[^\}]+\}\}/g, "")))
    if (ep.tags) {
        var hasWarning = false
        ep.tags.forEach(tag => {
            let tagcat = tagcats[tag]
            if (tagcat == 'warning') {
                if (!hasWarning) {
                    el.append("<i>Content warnings:</i> ")
                    hasWarning = true;
                    el.append($(`<i>${tagName(tag).toLowerCase()}</i>'`))
                }
                else {
                    el.append($(`<i>, ${tagName(tag).toLowerCase()}</i>'`))
                }
            }
        });
    }
    return el
}

function openTag(tag) {
    history.pushState({},"","?tag=" + tag)
    runQuery()
}

function openEpisode(slug) {
    history.pushState({},"","?episode=" + slug)
    runQuery()
}

function openHome() {
    history.pushState({},"","?")
    runQuery()
}

function openSearch() {
    history.pushState({},"","?search=")
    runQuery()
}

function openPage(page) {
    history.pushState({},"","?page=" + page)
    runQuery()
}

function playEpisode(slug, autoplay = true, seektime = 0) {
    let ep = eps[slug]
    if (ep) {

        $.cookie("nowplaying", slug, { expires: 14, path: '/' })

        $("#audio").html("<audio controls" + (autoplay ? " autoplay" : "") + "><source type='audio/mpeg' src='" + ep['media_url'] + "'/></audio>")
        $("#audio audio").on("timeupdate", onTimeUpdate)
        $("#audio audio").on("play", () => { 
            $("#player").removeClass("paused") 
            if (window.audioTimer) clearInterval(window.audioTimer)
            window.audioTimer = setInterval(onTimeUpdate, 50)
        } )
        $("#audio audio").on("pause", () => { 
            $("#player").addClass("paused") 
            if (window.audioTimer) clearInterval(window.audioTimer)
            } )
        if (seektime > 0) {
            $("#audio audio").on("canplaythrough", () => {
                $("#audio audio")[0].currentTime = seektime
            })
        }
        $("#playingtitle").html(`<a href='?episode=${ep.slug}' onclick='openEpisode("${ep.slug}"); return false'>${ep.title}</a>`)
        
        window.cards = []
        $.ajax({
            type: "get",
            url: "srt/" + slug + ".srt",
            success: response => {
                gotSRT(response)
            }
        });
        
        $("#feedbacklink").attr('href', feedbacklink + escape(slug))
    }
}

function gotSRT(text) {
    lines = text.split(/\r?\n/)
    window.cards = []
    let el = $("#transcript")
    el.text("").scrollTop(0)
    for (let i = 0; i < Math.floor(lines.length/4); i++) {
        let card = lines.slice(i*4,i*4+3)
        let ts1 = card[1].slice(0,2) * 3600 + card[1].slice(3,5) * 60 + card[1].slice(6,8) * 1 + card[1].slice(9,12)*0.001
        let ts2 = card[1].slice(17,19) * 3600 + card[1].slice(20,22) * 60 + card[1].slice(23,25) * 1 + card[1].slice(26,29)*0.001
        let cardtext = card[2].split("").reduce((acc, char) => char + acc, "").replace("<br>", "\n");
        if (cardtext.length > 16) { cardtext += " " }
        let pace = cardtext.length ? ((ts2-ts1) / cardtext.length) : 0;
        let c = 0
        Array(... cardtext.matchAll("[^\\s]+[\\s]*")).forEach((x) => {
            let t1 = ts1 + c * pace
            c += String(x).length
            let t2 = ts1 + c * pace
            let span = $("<span>" + String(x).replace("\n","<br>") + "</span>")
            span.click(() => { $("audio")[0].currentTime = ts1; $("audio")[0].play() })
            window.cards.push({
                "start": t1,
                "end": t2,
                "text": x,
                "span": span
            })
        })
    }
    window.cards.sort((a,b) => { return a.start - b.start })
    window.cards.forEach( card => {
        el.append(card.span)
    })
}
    
function onTimeUpdate() {
    let curTime = $("audio")[0].currentTime
    window.cards.forEach(card => {
        if (curTime > card.start && curTime < card.end+0.2) {
            if (!card.span.hasClass("highlight")) {
                card.span.addClass("highlight")
                card.span[0].scrollIntoView({
                    "behavior": "smooth",
                    "block": "center"
                })
                $.cookie("nowplaying_time", curTime, { expires: 14, path: '/' })
            }
        }
        else if (card.span.hasClass("highlight")) {
            card.span.removeClass("highlight")
        }
    });    
}
    