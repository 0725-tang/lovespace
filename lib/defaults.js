'use strict';

/**
 * 所有默认文案都在这里。
 * 首次启动会进入初始化页面，用户填写名字、相爱日期和生日后，
 * 这些默认文案会和用户信息一起写入 content/site.json。
 */
function createDefaultSite() {
  return {
    siteName: 'LoveSpace',
    setupComplete: false,
    couple: {
      me: '',
      her: '',
      meEmoji: '🌙',
      herEmoji: '🌸',
      anniversary: '',
      city: '',
      birthdays: {
        me: '',
        her: ''
      }
    },
    hero: {
      eyebrow: 'A LITTLE UNIVERSE, JUST FOR YOU',
      title: '你是我所有星轨的',
      titleAccent: '终点',
      subtitle: '把两个人的相遇、心动和每一次晚安，收进一颗只属于你们的星球。',
      primaryCta: '进入我们的宇宙',
      secondaryCta: '先读一封信'
    },
    counter: {
      label: '我们已经相爱',
      note: ''
    },
    next: {
      label: '距离下一次见面',
      date: '',
      note: ''
    },
    gallery: {
      eyebrow: 'OUR FRAME OF MEMORY',
      title: '照片墙',
      subtitle: '每一张，都是时间偷偷替你们按下的暂停键。'
    },
    timeline: {
      eyebrow: 'THE STORY WE WROTE',
      title: '恋爱时间线',
      subtitle: '从一句“你好”，到现在数不清的晚安。'
    },
    game: {
      eyebrow: 'A TINY GAME FOR YOU',
      title: '星光捕手',
      subtitle: '替我接住坠落的星光。30 秒后，有一句只给你看的话。',
      duration: 30,
      rewardTitle: '你接住了我的整片宇宙',
      reward: '其实，从遇见你的那天起，我的宇宙就没有冬天了。',
      rewardSignature: '—— 永远偏向你的我'
    },
    letter: {
      eyebrow: 'A LETTER SEALED WITH A KISS',
      title: '一封只给你看的信',
      subtitle: '信封里没有大事，只有一些平时不好意思说出口的话。',
      hint: '等你想说的时候，再把它封起来。',
      code: '',
      seal: 'L',
      paragraphs: [],
      signature: '',
      ps: ''
    },
    guestbook: {
      enabled: true,
      eyebrow: 'LEAVE A LITTLE LIGHT',
      title: '把一句话留在这里',
      subtitle: '对方点开链接时，也许会看见你偷偷留下的第一句。',
      quote: '有些话，说给星星听，\\n也会落到你心里。',
      note: '这一面墙只属于你们。公网分享时，请记得它也是公开的。',
      placeholder: '写一句只在这里出现的话……',
      namePlaceholder: '怎么称呼你？',
      empty: '还没有留言。第一句，留给你。',
      button: '把这句话留下'
    },
    assistant: {
      enabled: true,
      name: '小星',
      tagline: '你们的恋爱小助手',
      greeting: '嗨，我是小星。想聊聊你们的回忆，还是让我帮你想一个约会？',
      suggestions: ['我们在一起多久了？', '帮我规划一次约会', '讲一个我们的回忆', '想一句情话']
    },
    memoir: {
      title: '我们的故事',
      subtitle: '把每一次心动，按时间装订成册。',
      prologue: '这不是一本写给别人看的书。它只是把两个人一起走过的日子，按顺序放好。',
      epilogue: '故事还没有写完。下一章，仍然是你。'
    },
    footer: {
      line: '技术是冷的，但用技术爱你这件事，是热的。',
      credit: 'Made with LoveSpace · 一个可以自己部署的恋爱宇宙'
    }
  };
}

module.exports = { createDefaultSite };
