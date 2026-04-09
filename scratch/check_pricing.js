
async function checkPricing() {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models')
    const data = await resp.json()
    const models = data.data.filter(m => m.id.toLowerCase().includes('gemma-4'))
    
    console.log(JSON.stringify(models, null, 2))
  } catch (err) {
    console.error(err)
  }
}
checkPricing()
