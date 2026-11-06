Component({
  data: {
    active: 0,
    theme: '#FF6B35'
  },
  lifetimes: {
    attached() {
      const app = getApp()
      this.setData({ theme: app.globalData.themeColor || '#FF6B35' })
    }
  },
  methods: {
    switchTab(e) {
      const { idx, url } = e.currentTarget.dataset
      this.setData({ active: idx })
      wx.switchTab({ url })
    },
    setActive(idx) {
      const app = getApp()
      this.setData({ active: idx, theme: app.globalData.themeColor || '#FF6B35' })
    }
  }
})
