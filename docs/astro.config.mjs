import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import rehypeExternalLinks from 'rehype-external-links';

// GitHub Pages project site: https://sfship.github.io/plugin-ship/
export default defineConfig({
  site: 'https://sfship.github.io',
  base: '/plugin-ship',
  markdown: {
    rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]],
  },
  integrations: [
    starlight({
      title: 'sf ship',
      logo: { src: './src/assets/logo.svg' },
      customCss: ['./src/styles/custom.css'],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/sfship/plugin-ship' }],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Install & Setup', slug: 'getting-started' },
          ],
        },
        { label: 'Package Development', autogenerate: { directory: 'package-development' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
      ],
    }),
  ],
});
