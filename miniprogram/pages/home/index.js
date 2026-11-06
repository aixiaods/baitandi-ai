Page({
  data: {
    address: '',
    currentLat: 0,
    currentLng: 0,
    analyzing: false,
    result: null,
    saved: false,
    scoreColor: '#FF6B35',
    verdictBg: '#FFF3EE',
    verdictColor: '#FF6B35',
    showTheme: false,
    currentTheme: '#FF6B35',
    themeColors: [
      { color: '#FF6B35', name: '暖橙' },
      { color: '#00C9A7', name: '薄荷' },
      { color: '#5B8CFF', name: '天蓝' },
      { color: '#FF5B8C', name: '玫瑰' },
      { color: '#FFD700', name: '金黄' },
      { color: '#A855F7', name: '紫色' }
    ]
  },

  onShow() {
    const app = getApp()
    const theme = app.globalData.themeColor || '#FF6B35'
    this.setData({ currentTheme: theme })
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: '#0F1923' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive(0)
    }
  },

  openTheme() { this.setData({ showTheme: true }) },
  closeTheme() { this.setData({ showTheme: false }) },

  selectTheme(e) {
    const color = e.currentTarget.dataset.color
    getApp().setThemeColor(color)
    this.setData({ currentTheme: color, showTheme: false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive(0)
    }
  },

  onLoad() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          currentLat: res.latitude,
          currentLng: res.longitude,
          address: '已定位，点击开始分析'
        })
      },
      fail: () => {
        this.setData({ address: '定位失败，请检查权限' })
      }
    })
  },

  async analyze() {
    this.setData({ analyzing: true, result: null })
    // 超时兜底：30秒后自动恢复
    const timeoutId = setTimeout(() => {
      if (this.data.analyzing) {
        this.setData({ analyzing: false })
        wx.showToast({ title: '分析超时，请重试', icon: 'none' })
      }
    }, 30000)
    await new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.setData({
            currentLat: res.latitude,
            currentLng: res.longitude,
            address: '已定位，分析中...'
          })
          resolve()
        },
        fail: () => resolve()
      })
    })
    if (!this.data.currentLat) {
      clearTimeout(timeoutId)
      wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
      this.setData({ analyzing: false })
      return
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'analyzeLocation',
        data: {
          lat: this.data.currentLat,
          lng: this.data.currentLng
        }
      })
      clearTimeout(timeoutId)
      if (res.result.success) {
        const result = res.result.result
        const score = result.score
        const theme = this.data.currentTheme || '#FF6B35'
        const scoreColor = score >= 80 ? '#2ECC71' : score >= 60 ? theme : '#E74C3C'
        const verdictBg = score >= 80 ? 'rgba(46,204,113,0.15)' : score >= 60 ? `${theme}26` : 'rgba(231,76,60,0.15)'
        const verdictColor = score >= 80 ? '#2ECC71' : score >= 60 ? theme : '#E74C3C'
        const address = res.result.address || this.data.address
        this.setData({ result, scoreColor, verdictBg, verdictColor, address, saved: false })
      } else {
        wx.showToast({ title: '分析失败，请重试', icon: 'none' })
      }
    } catch (e) {
      clearTimeout(timeoutId)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ analyzing: false })
  },

  closePopup() {
    this.setData({ result: null, saved: false })
  },

  rescan() {
    this.setData({ result: null, saved: false })
    this.analyze()
  },

  async saveResult() {
    if (this.data.saved) return
    const { result, address, currentLat, currentLng } = this.data
    try {
      // 存入 reports 集合，和历史页保持一致（雷达简报格式）
      await wx.cloud.database().collection('reports').add({
        data: {
          report: {
            overall_score: result.score,
            summary: result.reason || '',
            scores: {
              location: { score: result.score, comment: result.reason || '' },
              category: { score: result.score, comment: '' },
              pricing: { score: result.score, comment: '' },
              operation: { score: result.score, comment: '' }
            },
            category_suggestion: result.best_category || [],
            pricing_range: { low: '-', high: '-', unit: '' },
            best_time_slots: result.best_time ? [result.best_time] : [],
            improvements: [],
            compliance_tips: result.risk || ''
          },
          input: {
            city: address || '',
            locationType: '雷达扫描',
            address,
            lat: currentLat,
            lng: currentLng
          },
          createTime: Date.now(),
          source: 'radar'
        }
      })
      this.setData({ saved: true })
      wx.showToast({ title: '已保存到记录', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  goFullEval() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
