import {stage, ticker, monitor, screen} from './core'
import {entry, preload, game, custom} from './scenes'
import {store, sound, wx as wechat} from './modules'
import dayjs from 'dayjs'

preload().then(() => {
  const {query: {id, scene}} = wx.getLaunchOptionsSync()
  if (scene && scene.length === 32) {
    custom.show(scene)
  } else entry.show()
  /* 来自分享 */
  id && wechat.cloud.verify(query.id).catch(console.log)
})

monitor
  .on('scene:go', (name, opt) => {
    name === 'game' ? game.show(opt) :
    name === 'entry' ? entry.show(opt) :
    name === 'custom' ? custom.show(opt) : 0
  })

/* BGM */
{
  const bgm = sound.load(
    'https://static.lufei.so/colloc/bgm.mp3',
    {volume: .5, loop: true}
  )

  store.setting.music && bgm.play()

  monitor
    .on('setting:music', ok => ok ? bgm.play() : bgm.pause())
    .on('ad:close', () => store.setting.music && bgm.paused && bgm.play())
    .on('wx:show', () => store.setting.music && bgm.paused && bgm.play())
}

/* 游戏圈 */
{
  const button = wx.createGameClubButton({
    icon: 'white',
    style: {
      left: 10,
      top: screen.height * .2,
      width: 40,
      height: 40
    }
  })

  button.hide()

  monitor
    .on('scene:show', name => name === 'entry' ? button.show() : button.hide())
    .on('scene:hide', name => name === 'entry' && button.hide())
}


/* 等待交互 */
{
  let resolve
  store.interaction = new Promise(a => resolve = a)
  wx.onTouchStart(handle)
  function handle() {
    wx.offTouchStart(handle)
    resolve(wx.getMenuButtonBoundingClientRect())
  }
}

/* 记录登录 */
{
  const {cloud, login} = wechat

  login().then(async info => {
    store.user = info.user

    let stuff = await cloud.transfer().catch(console.log)

    if (!stuff) return

    store.id = stuff

  }).catch(async () => {
    /* 拒绝授权 */
    let stuff = await cloud.transfer().catch(console.log)

    if (!stuff) return

    store.id = stuff
  }).then(async () => {
    if (!store.id) return

    let stuff = await cloud.find({_openid: store.id}).catch(console.log)

    if (stuff) {
      store.diamond = stuff.diamond || 0
      store.unlocked = Math.max(stuff.unlocked || 1, store.unlocked)
      cloud.update({
        ...store.user,
        stamp: Date.now(),
        date: dayjs().format('YYYY/MM/DD HH:mm:ss')
      })
    } else {
      cloud.set({
        ...store.user,
        diamond: 3,
        invitees: [],
        stamp: Date.now(),
        date: dayjs().format('YYYY/MM/DD HH:mm:ss')
      })
    }
  })
}

/* 检查更新 */
{
  const manager = wx.getUpdateManager()
  manager.onUpdateReady(() => {
    manager.applyUpdate()
  })
}