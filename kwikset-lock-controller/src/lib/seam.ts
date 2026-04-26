import { Seam } from 'seam'

let client: Seam | null = null

export function getSeamClient(): Seam {
  if (!client) {
    const apiKey = process.env.SEAM_API_KEY
    if (!apiKey) throw new Error('SEAM_API_KEY is not set')
    client = new Seam({ apiKey })
  }
  return client
}
