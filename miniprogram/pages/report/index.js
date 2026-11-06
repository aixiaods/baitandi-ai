const db = wx.cloud.database()

function scoreColor(s) {
  if (s >= 80) return '#2ECC71'
  if (s >= 60) return '#FF6B35'
  return '#E74C3C'
}

function priorityLabel(p) {
  if (p === 'high') return '重要'
  if (p === 'medium') return '建议'
  return '参考'
}

Page({
  data: {
    report: null,
    scores: {},
    bestTimeStr: '',
    showPoster: false,
    posterImage: '',
    posterLoading: false,
    posterScale: 1,
    posterNaturalH: 0,
    theme: '#FF6B35',
    loadError: false
  },

  async onLoad(options) {
    const theme = getApp().globalData.themeColor || '#FF6B35'
    this.setData({ theme })
    const { reportId } = options
    if (!reportId) return
    try {
      const res = await db.collection('reports').doc(reportId).get()
      const report = res.data.report
      if (!report) { this.setData({ loadError: true }); return }

      // 预处理模板需要的数据
      const scores = {}
      for (const key of ['location', 'category', 'pricing', 'operation']) {
        scores[key] = { color: scoreColor(report.scores[key].score) }
      }
      const improvements = report.improvements.map(i => ({
        ...i, priorityLabel: priorityLabel(i.priority)
      }))
      report.improvements = improvements

      this.setData({
        report,
        scores,
        bestTimeStr: report.best_time_slots.join('、')
      })
    } catch (e) {
      this.setData({ loadError: true })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goEvalAgain() {
    wx.navigateTo({ url: '/pages/questionnaire/index' })
  },

  onShareAppMessage() {
    const { report } = this.data
    return {
      title: `我的摆摊评分 ${report?.overall_score || ''}分！快来测测你的位置`,
      path: '/pages/index/index'
    }
  },

  showPoster() {
    this.setData({ showPoster: true, posterImage: '', posterLoading: true })
    // 等弹层渲染后再绘制
    setTimeout(() => this.drawPoster(), 300)
  },

  hidePoster() {
    this.setData({ showPoster: false, posterImage: '' })
  },

  savePoster() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImage,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (e) => {
        if (e.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册',
            success: (r) => { if (r.confirm) wx.openSetting() }
          })
        }
      }
    })
  },

  drawPoster() {
    const { report, theme } = this.data
    const accentColor = theme || '#FF6B35'
    const query = this.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      const W = 600

      // 第一步：用 measureText 计算动态高度，不实际绘制
      ctx.font = '26px sans-serif'
      const summaryLines = this.calcLines(ctx, report.summary, W - 80)
      const cats = (report.category_suggestion || []).slice(0, 3).join('  ·  ')
      ctx.font = '26px sans-serif'
      const catLines = this.calcLines(ctx, cats, W - 96)

      // 各模块高度累加
      const headerH = 220          // 顶部橙色区
      const summaryH = summaryLines * 38 + 20
      const scoresH = 50 + 88      // 分项评分区
      const sep1H = 30             // 分割线间距
      const catH = 50 + catLines * 36 + 20
      const priceH = 50 + 40 + 20
      const sep2H = 30
      const footerH = 100          // 底部引导+品牌
      const paddingBottom = 48

      const H = headerH + summaryH + scoresH + sep1H + catH + priceH + sep2H + footerH + paddingBottom

      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      // 第二步：正式绘制
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, W, H)

      // 顶部渐变
      const grad = ctx.createLinearGradient(0, 0, W, headerH)
      grad.addColorStop(0, accentColor)
      grad.addColorStop(1, accentColor + 'CC')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, headerH)

      // 标题
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🛒 摆摊AI评估报告', W / 2, 60)

      // 大分数
      ctx.font = 'bold 100px sans-serif'
      ctx.fillText(report.overall_score, W / 2, 160)

      ctx.font = '24px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText('综合评分', W / 2, 200)

      // 摘要（动态换行）
      let curY = headerH + 40
      ctx.fillStyle = '#444444'
      ctx.font = '26px sans-serif'
      ctx.textAlign = 'center'
      curY = this.wrapText(ctx, report.summary, W / 2, curY, W - 80, 38) + 20

      // 分项评分
      curY += 30
      const items = [
        { label: '选址', score: report.scores.location.score },
        { label: '选品', score: report.scores.category.score },
        { label: '定价', score: report.scores.pricing.score },
        { label: '运营', score: report.scores.operation.score }
      ]
      items.forEach((item, i) => {
        const x = 75 + i * 115
        ctx.fillStyle = scoreColor(item.score)
        ctx.font = 'bold 52px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(item.score, x, curY)
        ctx.fillStyle = '#888888'
        ctx.font = '24px sans-serif'
        ctx.fillText(item.label, x, curY + 38)
      })
      curY += 88

      // 分割线
      curY += 24
      ctx.strokeStyle = '#EEEEEE'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(48, curY)
      ctx.lineTo(W - 48, curY)
      ctx.stroke()
      curY += 40

      // 推荐品类
      ctx.fillStyle = '#1A1A1A'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('推荐品类', 48, curY)
      curY += 40
      ctx.fillStyle = accentColor
      ctx.font = '26px sans-serif'
      curY = this.wrapText(ctx, cats, 48, curY, W - 96, 36, 'left') + 20

      // 定价区间
      curY += 20
      ctx.fillStyle = '#1A1A1A'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('建议定价', 48, curY)
      curY += 40
      ctx.fillStyle = accentColor
      ctx.font = '26px sans-serif'
      ctx.fillText(`${report.pricing_range.low} - ${report.pricing_range.high} ${report.pricing_range.unit}`, 48, curY)
      curY += 30

      // 分割线
      curY += 24
      ctx.strokeStyle = '#EEEEEE'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(48, curY)
      ctx.lineTo(W - 48, curY)
      ctx.stroke()
      curY += 44

      // 底部引导
      ctx.fillStyle = '#AAAAAA'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('扫码免费评估你的摆摊方案', W / 2, curY)
      curY += 44
      ctx.fillStyle = accentColor
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('摆摊AI助手', W / 2, curY)

      // 导出图片
      const posterNaturalH = H
      wx.canvasToTempFilePath({
        canvas,
        success: (r) => {
          // 预览区固定高度 420px（rpx转px约为210px），宽300px
          // 海报宽600px，缩放到300px即scale=0.5，高度相应缩放
          const previewW = 300  // px，对应600rpx弹窗内容宽
          const scale = previewW / W
          this.setData({
            posterImage: r.tempFilePath,
            posterLoading: false,
            posterScale: scale,
            posterNaturalH
          })
        },
        fail: () => {
          wx.showToast({ title: '生成失败', icon: 'none' })
          this.setData({ posterLoading: false })
        }
      })
    })
  },

  // 计算文本需要几行（不绘制）
  calcLines(ctx, text, maxWidth) {
    const chars = text.split('')
    let line = ''
    let lines = 1
    for (const char of chars) {
      const testLine = line + char
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines++
        line = char
      } else {
        line = testLine
      }
    }
    return lines
  },

  // 自动换行，返回最后一行的Y坐标
  wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
    const chars = text.split('')
    let line = ''
    let currentY = y
    for (const char of chars) {
      const testLine = line + char
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY)
        line = char
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, currentY)
    return currentY
  }
})
