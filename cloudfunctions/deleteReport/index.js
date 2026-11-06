const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { id } = event
  if (!id) return { success: false, error: 'missing id' }
  try {
    await db.collection('reports').doc(id).remove()
    return { success: true, removed: 1 }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
