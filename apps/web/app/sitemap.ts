import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:              'https://xvpro.vercel.app',
      lastModified:     new Date(),
      changeFrequency:  'weekly',
      priority:         1,
    },
    {
      url:              'https://xvpro.vercel.app/login',
      lastModified:     new Date(),
      changeFrequency:  'monthly',
      priority:         0.8,
    },
    {
      url:              'https://xvpro.vercel.app/register',
      lastModified:     new Date(),
      changeFrequency:  'monthly',
      priority:         0.9,
    },
  ]
}
