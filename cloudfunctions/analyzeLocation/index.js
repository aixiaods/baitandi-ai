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

// 逆地址解析，获取城市/区域/详细地址
async function reverseGeocode(lat, lng) {
  const res = await httpsGet(
    `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TMAP_KEY}&get_poi=1&poi_options=page_size=5`
  )
  if (res.status === 0) {
    const r = res.result
    const ac = r.address_component || {}
    const detailAddr = [ac.city, ac.district, ac.street, ac.street_number]
      .filter(Boolean).join('')
    return {
      city: ac.city || '',
      district: ac.district || '',
      street: ac.street || '',
      streetNumber: ac.street_number || '',
      address: detailAddr || r.formatted_addresses?.recommend || r.address || '',
      rough: r.formatted_addresses?.recommend || r.address || '',
      pois: (r.pois || []).slice(0, 5).map(p => `${p.title}(距${p.distance || ''}米)`)
    }
  }
  return { city: '', district: '', street: '', streetNumber: '', address: '', rough: '', pois: [] }
}

// 分类别查询周边POI
async function fetchPOIByCategory(lat, lng, keyword) {
  const url = `https://apis.map.qq.com/ws/place/v1/search?boundary=nearby(${lat},${lng},500)&keyword=${encodeURIComponent(keyword)}&page_size=10&key=${TMAP_KEY}`
  const res = await httpsGet(url)
  console.log(`POI[${keyword}] status=${res.status} count=${res.data ? res.data.length : 0} msg=${res.message || ''}`)
  if (res.status === 0 && res.data) {
    return res.data
      .filter(p => !p._distance || p._distance <= 500)
      .map(p => `${p.title}(${p.category || keyword},距${Math.round(p._distance || 0)}米)`)
  }
  return []
}

async function fetchAllPOI(lat, lng) {
  // 合并关键词，减少接口调用次数（3次替代8次）
  const groups = ['学校,小区,商场', '超市,餐饮,菜市场', '地铁,公园']
  const results = await Promise.all(groups.map(c => fetchPOIByCategory(lat, lng, c)))
  return results.flat().slice(0, 30)
}

function buildPrompt(geoInfo, poiList) {
  const locationDesc = [
    geoInfo.city && `城市：${geoInfo.city}`,
    geoInfo.district && `区县：${geoInfo.district}`,
    geoInfo.street && `街道/路名：${geoInfo.street}`,
    geoInfo.streetNumber && `门牌：${geoInfo.streetNumber}`,
    geoInfo.address && `完整地址：${geoInfo.address}`,
    geoInfo.pois.length > 0 && `附近标志物：${geoInfo.pois.join('、')}`
  ].filter(Boolean).join('\n')

  const poiDesc = poiList.length > 0
    ? poiList.join('、')
    : '暂无周边POI数据'

  return `你是专业的摆摊选址顾问，请根据以下真实位置信息，从周边500米内挑选出一个最佳的具体摆摊位置。

【精确位置信息】
${locationDesc}

【周边500米内的场所】
${poiDesc}

分析要求：
1. spot字段必须给出一个具体的摆摊位置，格式为"XX路XX（地点）门口/附近/路边"，例如"光明路万达广场北门路边"
2. reason必须说明为什么这个具体位置好，提及周边2个真实地点名称，且这些地点必须在500米内
3. 禁止引用距离超过500米的地点，POI数据中有距离标注，请严格遵守
4. crowd_type结合周边具体场所描述主要客群
5. 所有内容必须基于上方真实数据，禁止编造

严格按以下JSON格式输出：
{
  "score": 78,
  "verdict": "适合摆摊",
  "spot": "XX路XX地点门口路边",
  "reason": "该位置紧邻XX和XX，人流密集，适合摆摊，2句话以内",
  "best_time": "最佳摆摊时段",
  "best_category": ["推荐品类1", "推荐品类2", "推荐品类3"],
  "crowd_type": "结合具体场所描述主要客群",
  "risk": "主要风险，1句话",
  "poi_summary": "一句话总结周边环境，必须含具体地点名称"
}`
}

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000
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
          reject(new Error('AI返回格式错误: ' + data.slice(0, 200)))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const { lat, lng } = event
  try {
    const [geoInfo, poiList] = await Promise.all([
      reverseGeocode(lat, lng),
      fetchAllPOI(lat, lng)
    ])

    const prompt = buildPrompt(geoInfo, poiList)
    const result = await callDeepSeek(prompt)

    const wxContext = cloud.getWXContext()
    await db.collection('location_analysis').add({
      data: {
        openid: wxContext.OPENID,
        lat, lng,
        address: geoInfo.address,
        poiCount: poiList.length,
        result,
        createTime: db.serverDate()
      }
    })

    return {
      success: true,
      result,
      address: geoInfo.address,
      poiCount: poiList.length
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
