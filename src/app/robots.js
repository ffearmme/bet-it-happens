export default function robots() {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/mod/'],
        },
        sitemap: 'https://betithappens.com/sitemap.xml',
    }
}
