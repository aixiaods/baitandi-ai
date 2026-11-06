Page({
  data: { theme: '#FF6B35' },
  onShow() {
    const theme = getApp().globalData.themeColor || '#FF6B35'
    this.setData({ theme })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive(1)
    }
  },
  startEval() {
    wx.navigateTo({ url: '/pages/questionnaire/index' })
  }
})
