App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d3giwtabh2443b433',
        traceUser: true,
      })
    }
    const saved = wx.getStorageSync('themeColor')
    this.globalData.themeColor = saved || '#FF6B35'
  },
  globalData: {
    themeColor: '#FF6B35'
  },
  setThemeColor(color) {
    this.globalData.themeColor = color
    wx.setStorageSync('themeColor', color)
  }
})
