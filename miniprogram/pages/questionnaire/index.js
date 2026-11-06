const TMAP_KEY = 'VTRBZ-77ZCI-ZZGGN-UTWSE-U5SC3-KIBGR'

Page({
  data: {
    step: 1,
    totalStep: 3,
    loading: false,
    locating: false,
    showSearch: false,
    searchKeyword: '',
    searchResults: [],
    theme: '#FF6B35',
    form: {
      city: '', budget: '', goal: '', timeSlot: '', hoursPerDay: '',
      hasCar: null, address: '', locationType: '', surroundings: '',
      hasCategory: false, category: '', lat: null, lng: null
    },
    budgetOptions: ['500元以内', '500-2000元', '2000-5000元', '5000元以上'],
    hoursOptions: ['1-2小时', '3-4小时', '5-6小时', '6小时以上']
  },

  onLoad() {
    const theme = getApp().globalData.themeColor || '#FF6B35'
    this.setData({ theme })
    this.relocate()
  },

  handleBack() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 })
    } else {
      wx.navigateBack()
    }
  },

  relocate() {
    this.setData({ locating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude: lat, longitude: lng } = res
        wx.request({
          url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TMAP_KEY}`,
          success: (r) => {
            const ac = r.data?.result?.address_component || {}
            const addr = r.data?.result?.formatted_addresses?.recommend || r.data?.result?.address || ''
            this.setData({
              locating: false,
              'form.lat': lat,
              'form.lng': lng,
              'form.address': addr,
              'form.city': ac.city || ac.district || ''
            })
          },
          fail: () => {
            this.setData({ locating: false, 'form.lat': lat, 'form.lng': lng, 'form.address': `${lat.toFixed(5)},${lng.toFixed(5)}` })
          }
        })
      },
      fail: () => {
        this.setData({ locating: false })
        wx.showToast({ title: '定位失败，请手动搜索', icon: 'none' })
      }
    })
  },

  openSearch() {
    this.setData({ showSearch: true, searchKeyword: '', searchResults: [] })
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    if (!keyword) { this.setData({ searchResults: [] }); return }
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      wx.request({
        url: `https://apis.map.qq.com/ws/place/v1/suggestion?keyword=${encodeURIComponent(keyword)}&key=${TMAP_KEY}&page_size=6`,
        success: (res) => {
          if (res.data.status === 0 && res.data.data) {
            this.setData({ searchResults: res.data.data })
          }
        }
      })
    }, 350)
  },

  selectSearchResult(e) {
    const item = this.data.searchResults[e.currentTarget.dataset.idx]
    this.setData({
      showSearch: false,
      searchResults: [],
      'form.address': item.address || item.title,
      'form.city': item.province || item.city || '',
      'form.lat': item.location?.lat || null,
      'form.lng': item.location?.lng || null
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  selectOption(e) {
    const { key, val } = e.currentTarget.dataset
    this.setData({ [`form.${key}`]: val })
  },

  selectBool(e) {
    const { key, val } = e.currentTarget.dataset
    this.setData({ [`form.${key}`]: val === 'true' || val === true })
  },

  toggleCategory(e) {
    const val = e.currentTarget.dataset.val === 'true' || e.currentTarget.dataset.val === true
    this.setData({ 'form.hasCategory': val })
  },

  openMap() {
    const { lat, lng } = this.data.form
    const url = lat && lng
      ? `/pages/map/index?lat=${lat}&lng=${lng}`
      : '/pages/map/index'
    wx.navigateTo({ url })
  },

  nextStep() {
    const { step, form } = this.data
    if (step === 1 && !form.address) return wx.showToast({ title: '请先选择位置', icon: 'none' })
    if (step === 1 && !form.budget) return wx.showToast({ title: '请选择预算', icon: 'none' })
    if (step === 1 && !form.goal) return wx.showToast({ title: '请选择目标', icon: 'none' })
    if (step === 2 && !form.timeSlot) return wx.showToast({ title: '请选择时间段', icon: 'none' })
    if (step === 2 && !form.hoursPerDay) return wx.showToast({ title: '请选择时长', icon: 'none' })
    this.setData({ step: step + 1 })
  },

  prevStep() {
    this.setData({ step: this.data.step - 1 })
  },

  async submit() {
    this.setData({ loading: true })
    const timeoutId = setTimeout(() => {
      if (this.data.loading) {
        this.setData({ loading: false })
        wx.showToast({ title: '生成超时，请重试', icon: 'none' })
      }
    }, 60000)
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateReport',
        data: this.data.form
      })
      clearTimeout(timeoutId)
      if (res.result.success) {
        wx.navigateTo({ url: `/pages/report/index?reportId=${res.result.reportId}` })
      } else {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      }
    } catch (e) {
      clearTimeout(timeoutId)
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
    this.setData({ loading: false })
  }
})
