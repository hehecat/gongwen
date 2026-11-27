export async function convertFileToSupportedDataUrl(file: File): Promise<string> {
  const isNativePngOrJpg = /^image\/(png|jpe?g)$/i.test(file.type)
    || /\.(png|jpe?g)$/i.test(file.name)

  if (isNativePngOrJpg) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })
  }

  // SVG / WebP 等先经 Canvas 光栅化为高分辨率 PNG，确保 Word ImageRun 稳定嵌入
  return await new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const targetWidth = Math.max(1000, img.naturalWidth || 1200)
        const ratio = (img.naturalHeight || 200) / (img.naturalWidth || 1200)
        const targetHeight = Math.max(120, Math.round(targetWidth * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('无法初始化画布')
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法解析该图片格式，建议使用 PNG、JPG 或标准 SVG'))
    }
    img.src = objectUrl
  })
}
