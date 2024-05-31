$.cookie.json = true;

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
})

function gotIndex(response) {
    window.index = response
    window.eps = {}
    index.episodes.forEach(ep => {
        eps[ep.slug] = ep
    })

    // Sidebar
    Object.keys(index.tagnames).sort().forEach(tag => {
        let tagsplit = tag.split(":", 2)
        let tagcat = tagsplit[0]
        $("#tags_" + tagcat).append($(`<li><a onclick='openTag("${tag}")'>${index.tagnames[tag]}</a></li> `))
    })

    window.onpopstate = runQuery

    runQuery()

    let nowplaying = $.cookie("nowplaying")
    if (nowplaying) {
        console.log("Resuming " + nowplaying)
        playEpisode(nowplaying, false, $.cookie("nowplaying_time"))
    }
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
    else {
        $("#main").append($("<h1>").text("This week's episode"))
        $("#main").append(epSummary(index.episodes[0]))
    }
    $("body").scrollTop(0)
}

function tagName(x) {
    return index.tagnames[x] || x
}

function epSummary(ep) {
    let el = $("<div class='epsummary'>")
    el.append(
        $("<span class='playbutton'>")
        .text("Play episode ▷")
        .click(() => { playEpisode(ep.slug) })
    )
    el.append(
        $("<h2>")
        .text(ep.title)
        .click(() => { playEpisode(ep.slug) })
    )
    let tags = $("<ul class='showtags'>")
    ep.tags.forEach(tag => {
        let tagsplit = tag.split(":", 2)
        if (tagsplit[0] != 'warning') {
            tags.append($(`<li class='tag_${tagsplit[0]}'><a onclick='openTag("${tag}")'>${tagName(tag)}</a> </li>'`))        
        }
    });
    el.append(tags)
    el.append($("<div class='shownotes'>").html(ep.shownotes))
    var hasWarning = false
    ep.tags.forEach(tag => {
        let tagsplit = tag.split(":", 2)
        if (tagsplit[0] == 'warning') {
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
    return el
}

function openTag(tag) {
    history.pushState({},"","?tag=" + tag)
    runQuery()
}

function playEpisode(slug, autoplay = true, seektime = 0) {
    let ep = eps[slug]
    if (ep) {

        $.cookie("nowplaying", slug)

        $("#audio").html("<audio controls" + (autoplay ? " autoplay" : "") + "><source type='audio/mpeg' src='" + ep['media_url'] + "'/></audio>")
        $("#audio audio").on("timeupdate", onTimeUpdate)
        if (seektime > 0) {
            $("#audio audio").on("canplaythrough", () => {
                $("#audio audio")[0].currentTime = seektime
            })
        }
        $("#playingtitle").text(ep.title)
        
        $.ajax({
            type: "get",
            url: "srt/" + slug + ".srt",
            success: response => {
                gotSRT(response)
            }
        });
        
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
        let text = card[2].split("").reduce((acc, char) => char + acc, "");
        let span = $("<span>" + text + " </span>")
        span.click(() => { $("audio")[0].currentTime = ts1; $("audio")[0].play() })
        window.cards.push({
            "start": ts1,
            "end": ts2,
            "text": text,
            "span": span
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
        if (curTime > card.start && curTime < card.end && !card.span.hasClass("highlight")) {
            $(".highlight").removeClass("highlight")
            card.span.addClass("highlight")
            card.span[0].scrollIntoView({
                "behavior": "smooth",
                "block": "center"
            })
            $.cookie("nowplaying_time", curTime)
        }
    });    
}
    