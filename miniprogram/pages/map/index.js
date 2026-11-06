const TMAP_KEY = 'VTRBZ-77ZCI-ZZGGN-UTWSE-U5SC3-KIBGR'

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    scale: 16,
    addrName: '',
    addrDetail: '',
    currentLat: 39.9042,
    currentLng: 116.4074,
    locating: false,
    searchKeyword: '',
    searchResults: [],
    theme: '#FF6B35'
  },

  onLoad(options) {
    const theme = getApp().globalData.themeColor || '#FF6B35'
    this.setData({ theme })
    if (options.lat && options.lng) {
      const lat = parseFloat(options.lat)
      const lng = parseFloat(options.lng)
      this.setData({ latitude: lat, longitude: lng, currentLat: lat, currentLng: lng })
      this.reverseGeocode(lat, lng)
    } else {
      this.setData({ locating: true })
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.setData({
            latitude: res.latitude,
            longitude: res.longitude,
            currentLat: res.latitude,
            currentLng: res.longitude,
            locating: false
          })
          this.reverseGeocode(res.latitude, res.longitude)
        },
        fail: () => {
          this.setData({ locating: false })
        }
      })
    }
  },

  onRegionChange(e) {
    if (e.type === 'end') {
      const mapCtx = wx.createMapContext('map', this)
      mapCtx.getCenterLocation({
        success: (res) => {
          this.setData({
            currentLat: res.latitude,
            currentLng: res.longitude,
            locating: true,
            addrName: '',
            addrDetail: ''
          })
          this.reverseGeocode(res.latitude, res.longitude)
        }
      })
    }
  },

  reverseGeocode(lat, lng) {
    wx.request({
      url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TMAP_KEY}&get_poi=1`,
      success: (res) => {
        if (res.data.status === 0) {
          const result = res.data.result
          const name = result.pois && result.pois.length > 0
            ? result.pois[0].title
            : result.address_component?.street || result.address
          const detail = result.formatted_addresses?.recommend || result.address
          this.setData({ addrName: name, addrDetail: detail, locating: false })
        } else {
          this.setData({
            addrName: `位置 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            addrDetail: '未能解析详细地址',
            locating: false
          })
        }
      },
      fail: () => {
        this.setData({
          addrName: `位置 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          addrDetail: '未能解析详细地址',
          locating: false
        })
      }
    })
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    if (!keyword) { this.setData({ searchResults: [] }); return }
    wx.request({
      url: `https://apis.map.qq.com/ws/place/v1/suggestion?keyword=${encodeURIComponent(keyword)}&key=${TMAP_KEY}&page_size=6`,
      success: (res) => {
        if (res.data.status === 0 && res.data.data) {
          this.setData({ searchResults: res.data.data })
        } else {
          this.setData({ searchResults: [] })
        }
      }
    })
  },

  selectSearchResult(e) {
    const item = this.data.searchResults[e.currentTarget.dataset.idx]
    if (!item.location) return
    const lat = item.location.lat
    const lng = item.location.lng
    this.setData({
      latitude: lat,
      longitude: lng,
      currentLat: lat,
      currentLng: lng,
      searchKeyword: item.title,
      searchResults: [],
      addrName: item.title,
      addrDetail: item.address || ''
    })
  },

  clearSearch() {
    this.setData({ searchKeyword: '', searchResults: [] })
  },

  confirm() {
    const { addrName, addrDetail, currentLat, currentLng } = this.data
    const pages = getCurrentPages()
    // 找到问卷页（不管页面栈层级）
    const prevPage = pages.slice().reverse().find(p => p.route && p.route.includes('questionnaire'))
      || pages[pages.length - 2]
    prevPage.setData({
      'form.address': addrName,
      'form.surroundings': addrDetail || '',
      'form.lat': currentLat,
      'form.lng': currentLng
    })
    wx.navigateBack()
  }
})
