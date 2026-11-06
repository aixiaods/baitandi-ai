const db = wx.cloud.database()

Page({
  data: { list: [], theme: '#FF6B35' },

  async onShow() {
    const theme = getApp().globalData.themeColor || '#FF6B35'
    this.setData({ theme })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive(2)
    }
    this.loadList()
  },

  async loadList() {
    try {
      const res = await db.collection('reports')
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      const list = res.data.map(item => ({
        ...item,
        createTimeStr: item.createTime
          ? new Date(item.createTime).toLocaleDateString('zh-CN')
          : ''
      }))
      this.setData({ list })
    } catch (e) {
      console.error(e)
    }
  },

  viewReport(e) {
    wx.navigateTo({ url: `/pages/report/index?reportId=${e.currentTarget.dataset.id}` })
  },

  confirmDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除记录',
      content: '确认删除这条评估报告？',
      confirmText: '删除',
      confirmColor: '#E74C3C',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'deleteReport',
              data: { id }
            })
            if (result.result.success) {
              this.setData({ list: this.data.list.filter(i => i._id !== id) })
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  goEval() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
