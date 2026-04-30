import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
})

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  filename: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:      filename,
        resource_type:  'image',
        transformation: [{ width: 1200, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload falhou'))
        resolve(result.secure_url)
      },
    )
    stream.end(buffer)
  })
}
