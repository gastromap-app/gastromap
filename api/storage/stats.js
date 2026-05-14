/**
 * Vercel Serverless — R2 Storage Statistics
 * 
 * Returns storage usage stats for the Cloudflare R2 bucket.
 * Uses ListObjectsV2 to count objects and sum sizes.
 * 
 * Response: { usedBytes, usedMB, usedGB, objectCount, limitGB, percentUsed }
 */

import { setCorsHeaders } from '../_shared/cors.js'
import { applyRateLimit } from '../_shared/rate-limit.js'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const {
    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME,
} = process.env

// R2 free tier: 10 GB storage, 10 million Class B operations/month
const R2_FREE_TIER_LIMIT_GB = 10

const s3 = (R2_ACCESS_KEY_ID && R2_ENDPOINT) ? new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
}) : null

export default async function handler(req, res) {
    setCorsHeaders(req, res)

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    // Rate limit: 5 req/min (this is an expensive operation)
    if (applyRateLimit(req, res, 'storage-stats', { maxRequests: 5, windowMs: 60000 })) return

    if (!s3 || !R2_BUCKET_NAME) {
        return res.status(503).json({ error: 'R2 not configured' })
    }

    try {
        let totalSize = 0
        let objectCount = 0
        let continuationToken = undefined

        // Paginate through all objects to get total size
        do {
            const command = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
            })

            const response = await s3.send(command)

            if (response.Contents) {
                for (const obj of response.Contents) {
                    totalSize += obj.Size || 0
                    objectCount++
                }
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
        } while (continuationToken)

        const usedMB = Math.round(totalSize / (1024 * 1024) * 10) / 10
        const usedGB = Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100
        const percentUsed = Math.round((usedGB / R2_FREE_TIER_LIMIT_GB) * 100 * 10) / 10

        return res.status(200).json({
            usedBytes: totalSize,
            usedMB,
            usedGB,
            objectCount,
            limitGB: R2_FREE_TIER_LIMIT_GB,
            percentUsed,
        })
    } catch (err) {
        console.error('[storage/stats] Error:', err.message)
        return res.status(502).json({ error: 'Failed to fetch storage stats' })
    }
}
