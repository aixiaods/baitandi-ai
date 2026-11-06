const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const TMAP_KEY = process.env.TMAP_KEY

function httpsGet(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { resolve({ status: -1 }) }
      })
    }).on('error', () => resolve({ status: -1 }))
  })
}

async function fetchPOI(lat, lng) {
  if (!lat || !lng) return []
  const groups = ['学校,小区,商场', '超市,餐饮,菜市场', '地铁,公园']
  const results = await Promise.all(groups.map(keywords =>
    httpsGet(`https://apis.map.qq.com/ws/place/v1/search?boundary=nearby(${lat},${lng},500)&keyword=${encodeURIComponent(keywords)}&page_size=10&key=${TMAP_KEY}`)
      .then(res => (res.status === 0 && res.data)
        ? res.data.filter(p => !p._distance || p._distance <= 500).map(p => `${p.title}(${p.category || ''})`)
        : []
      )
  ))
  return results.flat().slice(0, 25)
}

function buildPrompt(data, poiList) {
  const poiDesc = poiList.length > 0 ? poiList.join('、') : '暂无周边POI数据'

  return `你是一位专业的摆摊创业顾问，请根据以下新手摆摊者的真实位置和信息生成摆摊评估报告。

【用户信息】
当前季节：${data.season}（${data.month}月）
计划摆摊时间段：${data.timeSlot}
启动预算：${data.budget}
摆摊目标：${data.goal}
每天可摆小时数：${data.hoursPerDay}
是否有车：${data.hasCar ? '有' : '没有'}

【摊位位置】
详细地址：${data.address || '未提供'}
${data.surroundings ? `周边描述：${data.surroundings}` : ''}

【周边500米真实场所】
${poiDesc}

【品类意向】
${data.category || '请AI根据以上信息推荐适合的品类'}

分析要求：所有点评必须结合上方真实地址和周边场所，禁止泛泛而谈。

请严格按照以下JSON格式输出，不要输出任何JSON以外的内容：
{
  "overall_score": 75,
  "summary": "整体一句话评价，必须提及具体地址和周边特征",
  "scores": {
    "location": { "score": 80, "comment": "选址点评（2-3句话，结合具体地址和周边场所）" },
    "category": { "score": 70, "comment": "选品点评（2-3句话，结合周边客群）" },
    "pricing": { "score": 75, "comment": "定价点评（2-3句话）" },
    "operation": { "score": 72, "comment": "运营点评（2-3句话）" }
  },
  "category_suggestion": ["推荐品类1", "推荐品类2", "推荐品类3"],
  "pricing_range": { "low": 15, "high": 35, "unit": "元/份" },
  "best_time_slots": ["18:00-20:00", "周末全天"],
  "improvements": [
    { "priority": "high", "title": "建议标题", "detail": "具体建议内容" },
    { "priority": "medium", "title": "建议标题", "detail": "具体建议内容" },
    { "priority": "low", "title": "建议标题", "detail": "具体建议内容" }
  ],
  "compliance_tips": "本地摆摊合规提示"
}`
}

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000
    })
    const options = {
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(JSON.parse(parsed.choices[0].message.content))
        } catch (e) {
          reject(new Error('AI返回格式错误: ' + data))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  try {
    const month = new Date().getMonth() + 1
    const season = month >= 3 && month <= 5 ? '春季' : month >= 6 && month <= 8 ? '夏季' : month >= 9 && month <= 11 ? '秋季' : '冬季'
    const poiList = await fetchPOI(event.lat, event.lng)
    const prompt = buildPrompt({ ...event, season, month }, poiList)
    const report = await callDeepSeek(prompt)

    const wxContext = cloud.getWXContext()
    const saveResult = await db.collection('reports').add({
      data: {
        openid: wxContext.OPENID,
        input: event,
        report,
        poiCount: poiList.length,
        createTime: db.serverDate()
      }
    })

    return { success: true, report, reportId: saveResult._id }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
