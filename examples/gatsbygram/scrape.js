const fs = require(`fs`)
const request = require(`request`)
const mkdirp = require(`mkdirp`)
const ProgressBar = require(`progress`)
const { get } = require(`lodash`)
const download = require(`./utils/download-file`)

const username = process.argv[2]

if (!username) {
  console.log(
    `
You didn't supply an Instagram username!
Run this command like:

node scrape.js INSTAGRAM_USERNAME
    `
  )
  process.exit()
}

// Convert timestamp to ISO 8601.
const toISO8601 = timestamp => new Date(timestamp * 1000).toJSON()

// Create the progress bar
const bar = new ProgressBar(
  `Downloading instagram posts [:bar] :current/:total :elapsed secs :percent`,
  {
    total: 0,
    width: 30,
  }
)

// Create the images directory
mkdirp.sync(`./data/images`)

const user = {
  username: ``,
  avatar: ``,
  posts: [],
}

// Write json
const saveJSON = _ =>
  fs.writeFileSync(`./data/posts.json`, JSON.stringify(user, ``, 2))

const getPosts = maxId => {
  let url = `https://www.instagram.com/${username}/?__a=1`
  if (maxId) url += `&max_id=${maxId}`

  request(url, { encoding: `utf8` }, (err, res, body) => {
    if (err) console.log(`error: ${err}`)
    body = JSON.parse(body)
    user.username = get(body, `user.username`)
    user.avatar = get(body, `user.profile_pic_url`)
    body.user.media.nodes
      .filter(item => item[`__typename`] === `GraphImage`)
      .map(item => {
        // Parse item to a simple object
        return {
          id: get(item, `id`),
          code: get(item, `code`),
          time: toISO8601(get(item, `date`)),
          type: get(item, `__typename`),
          likes: get(item, `likes.count`),
          comment: get(item, `comments.count`),
          text: get(item, `caption`),
          media: get(item, `display_src`),
          image: `images/${item.code}.jpg`,
        }
      })
      .forEach(item => {
        if (user.posts.length >= 100) return

        // Download image locally and update progress bar
        bar.total++
        download(item.media, `./data/images/${item.code}.jpg`, _ => bar.tick())

        // Add item to posts
        user.posts.push(item)
      })

    const lastId = get(body, `user.media.page_info.end_cursor`)
    if (user.posts.length < 100 && lastId) getPosts(lastId)
    else saveJSON()
  })
}

getPosts()
