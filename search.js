ObjC.import('Cocoa')

function stripHTML (s) {
  return s.replace(/(&lt;([^&gt;]+)&gt;)/ig, '')
}

function formattingNumbers (n) {
  // http://stackoverflow.com/questions/2254185/regular-expression-for-formatting-numbers-in-javascript
  return n.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function search (q) {
  var stdout = $.NSPipe.pipe
  var task = $.NSTask.alloc.init

  task.setLaunchPath('/usr/bin/curl')
  task.setArguments([
    `https://apis.daum.net/search/book?apikey=c31f26d40adbfb910810b6a15cb1ab45&output=json&sort=popular&result=20&q=${encodeURIComponent(q.normalize('NFC'))}`
  ])
  task.standardOutput = stdout
  task.launch

  var dataOut = stdout.fileHandleForReading.readDataToEndOfFile
  var stringOut = $.NSString.alloc.initWithDataEncoding(dataOut, $.NSUTF8StringEncoding).js

  return JSON.parse(stripHTML(stringOut))
}

function coverDownload (url, output) {
  var task = $.NSTask.alloc.init

  task.setLaunchPath('/usr/bin/curl')
  task.setArguments([
    url,
    '-o',
    output
  ])
  task.launch
}

function render (q) {
  var response = search(q)
  var lists = []

  if (response.error) {
    lists.unshift(`
        <item valid="NO">
            <title>${response.error}</title>
        </item>`)
    lists.join('\n')
  } else {
    if (response.channel.item.length === 0) {
      lists.unshift(`
          <item valid="NO">
          <title>"${q}" 란 책을 찾을 수가 없다고 합니다.</title>
          </item>`)
      lists.join('\n')
    } else {
      if (response.channel.totalCount > 20) {
        lists.unshift(`
            <item valid="NO">
            <title>"${q}" 로 검색한 항목이 총 ${formattingNumbers(response.channel.totalCount)} 개 있지만, ${formattingNumbers(response.channel.item.length)}개만 보여줍니다. </title>
            <subtitle>좀 더 명확한 키워드로 검색해 주세요.</subtitle>
            </item>`)
        lists.join('\n')
      }

      lists = lists.concat(response.channel.item
        .map(function (i) {
          if (i.cover_s_url) {
            coverDownload(i.cover_s_url, `/tmp/${i.isbn}.jpg`)
          }

          var additionInfo = []

          if (i.author) {
            additionInfo.push('저자: ' + i.author)
          }

          if (i.translator) {
            additionInfo.push('역자: ' + i.translator)
          }

          if (i.pub_nm) {
            additionInfo.push('출판사: ' + i.pub_nm)
          }

          return `
                <item valid="YES" autocomplete="${stripHTML(i.title)}">
                  <title>${stripHTML(i.title)}</title>
                  <icon>${i.cover_s_url ? `/tmp/${i.isbn}.jpg` : ''}</icon>
                  <subtitle>${i.description}</subtitle>
                  <subtitle mod="ctrl">${additionInfo.join(' / ')}</subtitle>
                  <subtitle mod="shift">가격 : ${formattingNumbers(i.list_price)}원</subtitle>
                  <quicklookurl>${i.link}</quicklookurl>
                  <arg>${JSON.stringify(i)}</arg>
                </item>`
        })).join('\n')
    }
  }

  return `<?xml version='1.0' encoding="UTF-8"?>
<items>
${lists}
</items>`
}

if (typeof module === 'object') {
  module.exports = render
}
