import vision from '@google-cloud/vision'

export interface DocumentQuality {
  faceDetected: boolean
  faceConfidence: number
  documentDetected: boolean
  textQuality: number
  overallScore: number
}

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

/**
 * Analisa qualidade de documento KYC usando Google Vision API
 * Retorna scores de 0-100 para cada aspecto
 */
export async function analyzeKYCDocument(
  base64Image: string,
  documentType: 'selfie' | 'bi_front' | 'bi_back'
): Promise<DocumentQuality> {
  try {
    // Request image annotation
    const request = {
      image: { content: base64Image.split(',')[1] || base64Image },
      features: [
        { type: 'FACE_DETECTION' as const },
        { type: 'DOCUMENT_TEXT_DETECTION' as const },
        { type: 'IMAGE_PROPERTIES' as const },
      ],
    }

    const [result] = await client.annotateImage(request)

    // Detectar rosto
    const faces = result.faceAnnotations || []
    const faceDetected = faces.length > 0

    let faceConfidence = 0
    if (faceDetected && faces[0].detectionConfidence) {
      faceConfidence = Math.round(faces[0].detectionConfidence * 100)
    }

    // Detectar documento/texto
    const textResult = result.fullTextAnnotation
    const documentDetected = !!textResult && !!textResult.text
    
    let textQuality = 0
    if (documentDetected && textResult?.text) {
      // Contar linhas de texto — mais linhas = melhor qualidade
      const lines = textResult.text.split('\n').filter(l => l.trim().length > 0)
      textQuality = Math.min(100, Math.round((lines.length / 5) * 100))
    }

    // Calcular score geral
    // Para selfie: rosto é mais importante (70%)
    // Para BI: texto é mais importante (70%)
    let overallScore
    if (documentType === 'selfie') {
      overallScore = Math.round(faceConfidence * 0.7 + textQuality * 0.3)
    } else {
      overallScore = Math.round(textQuality * 0.7 + faceConfidence * 0.3)
    }

    // Bonus se ambos forem detectados
    if (faceDetected && documentDetected) {
      overallScore = Math.min(100, overallScore + 5)
    }

    return {
      faceDetected,
      faceConfidence,
      documentDetected,
      textQuality,
      overallScore,
    }
  } catch (err) {
    console.error('Vision API error:', err)
    // Return conservative scores on error
    return {
      faceDetected: false,
      faceConfidence: 0,
      documentDetected: false,
      textQuality: 0,
      overallScore: 0,
    }
  }
}

/**
 * Batch analysis para múltiplos documentos
 */
export async function analyzeKYCDocuments(
  documents: { base64: string; type: 'selfie' | 'bi_front' | 'bi_back' }[]
): Promise<DocumentQuality[]> {
  return Promise.all(
    documents.map((doc) => analyzeKYCDocument(doc.base64, doc.type))
  )
}
