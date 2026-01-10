import { SiteCategory, CategoryInfo, CustomCategory } from './types';

// Built-in category display information
export const CATEGORIES: CategoryInfo[] = [
  { id: 'social', name: 'Social Media', color: 'bg-pink-500' },
  { id: 'entertainment', name: 'Entertainment', color: 'bg-purple-500' },
  { id: 'news', name: 'News & Media', color: 'bg-blue-500' },
  { id: 'shopping', name: 'Shopping', color: 'bg-orange-500' },
  { id: 'productivity', name: 'Productivity', color: 'bg-green-500' },
  { id: 'development', name: 'Development', color: 'bg-gray-700' },
  { id: 'education', name: 'Education', color: 'bg-teal-500' },
  { id: 'communication', name: 'Communication', color: 'bg-indigo-500' },
  { id: 'other', name: 'Other', color: 'bg-gray-400' },
];

// Built-in category IDs for checking
export const BUILTIN_CATEGORY_IDS: SiteCategory[] = [
  'social', 'entertainment', 'news', 'shopping', 'productivity',
  'development', 'education', 'communication', 'other'
];

// Color options for custom categories
export const CATEGORY_COLOR_OPTIONS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500', 'bg-gray-500',
];

// Check if a category ID is a built-in category
export function isBuiltInCategory(id: string): id is SiteCategory {
  return BUILTIN_CATEGORY_IDS.includes(id as SiteCategory);
}

// Get category info by ID (for built-in categories only)
export function getCategoryInfo(id: string): CategoryInfo {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// Get category info with support for custom categories and name overrides
export function getCategoryInfoWithOverrides(
  id: string,
  customCategories: CustomCategory[],
  builtInOverrides: Record<string, string>
): CategoryInfo {
  // Check if it's a custom category
  const customCat = customCategories.find(c => c.id === id);
  if (customCat) {
    return { id: customCat.id, name: customCat.name, color: customCat.color };
  }

  // Check if it's a built-in category
  if (isBuiltInCategory(id)) {
    const builtIn = CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
    const overrideName = builtInOverrides[id];
    return {
      id: builtIn.id,
      name: overrideName || builtIn.name,
      color: builtIn.color,
    };
  }

  // Fallback to "other"
  return CATEGORIES[CATEGORIES.length - 1];
}

// Pre-built domain to category mappings
export const DEFAULT_DOMAIN_CATEGORIES: Record<string, SiteCategory> = {
  // Social Media
  'twitter.com': 'social',
  'x.com': 'social',
  'facebook.com': 'social',
  'instagram.com': 'social',
  'linkedin.com': 'social',
  'tiktok.com': 'social',
  'reddit.com': 'social',
  'threads.net': 'social',
  'pinterest.com': 'social',
  'snapchat.com': 'social',
  'tumblr.com': 'social',
  'mastodon.social': 'social',
  'bsky.app': 'social',
  'discord.com': 'social',
  'quora.com': 'social',
  'flickr.com': 'social',
  'weibo.com': 'social',
  'vk.com': 'social',
  'nextdoor.com': 'social',
  'meetup.com': 'social',

  // Entertainment - Video
  'youtube.com': 'entertainment',
  'netflix.com': 'entertainment',
  'twitch.tv': 'entertainment',
  'hulu.com': 'entertainment',
  'disneyplus.com': 'entertainment',
  'hbomax.com': 'entertainment',
  'max.com': 'entertainment',
  'primevideo.com': 'entertainment',
  'peacocktv.com': 'entertainment',
  'paramountplus.com': 'entertainment',
  'crunchyroll.com': 'entertainment',
  'funimation.com': 'entertainment',
  'vimeo.com': 'entertainment',
  'dailymotion.com': 'entertainment',
  'pluto.tv': 'entertainment',
  'tubi.tv': 'entertainment',
  'roku.com': 'entertainment',
  'plex.tv': 'entertainment',
  'appletv.com': 'entertainment',

  // Entertainment - Music
  'spotify.com': 'entertainment',
  'music.apple.com': 'entertainment',
  'soundcloud.com': 'entertainment',
  'pandora.com': 'entertainment',
  'deezer.com': 'entertainment',
  'tidal.com': 'entertainment',
  'bandcamp.com': 'entertainment',
  'last.fm': 'entertainment',
  'genius.com': 'entertainment',

  // Entertainment - Gaming
  'steampowered.com': 'entertainment',
  'store.steampowered.com': 'entertainment',
  'epicgames.com': 'entertainment',
  'gog.com': 'entertainment',
  'itch.io': 'entertainment',
  'roblox.com': 'entertainment',
  'minecraft.net': 'entertainment',
  'ea.com': 'entertainment',
  'ubisoft.com': 'entertainment',
  'blizzard.com': 'entertainment',
  'battle.net': 'entertainment',
  'xbox.com': 'entertainment',
  'playstation.com': 'entertainment',
  'nintendo.com': 'entertainment',
  'ign.com': 'entertainment',
  'gamespot.com': 'entertainment',
  'kotaku.com': 'entertainment',
  'polygon.com': 'entertainment',
  'pcgamer.com': 'entertainment',

  // Entertainment - Other
  'imdb.com': 'entertainment',
  'rottentomatoes.com': 'entertainment',
  'letterboxd.com': 'entertainment',
  'goodreads.com': 'entertainment',
  '9gag.com': 'entertainment',
  'imgur.com': 'entertainment',
  'giphy.com': 'entertainment',
  'buzzfeed.com': 'entertainment',

  // News & Media
  'cnn.com': 'news',
  'bbc.com': 'news',
  'bbc.co.uk': 'news',
  'nytimes.com': 'news',
  'theguardian.com': 'news',
  'reuters.com': 'news',
  'apnews.com': 'news',
  'washingtonpost.com': 'news',
  'wsj.com': 'news',
  'ft.com': 'news',
  'bloomberg.com': 'news',
  'cnbc.com': 'news',
  'foxnews.com': 'news',
  'msnbc.com': 'news',
  'nbcnews.com': 'news',
  'abcnews.go.com': 'news',
  'cbsnews.com': 'news',
  'usatoday.com': 'news',
  'latimes.com': 'news',
  'nypost.com': 'news',
  'dailymail.co.uk': 'news',
  'huffpost.com': 'news',
  'politico.com': 'news',
  'thehill.com': 'news',
  'axios.com': 'news',
  'vox.com': 'news',
  'vice.com': 'news',
  'theatlantic.com': 'news',
  'newyorker.com': 'news',
  'economist.com': 'news',
  'time.com': 'news',
  'newsweek.com': 'news',
  'forbes.com': 'news',
  'businessinsider.com': 'news',
  'insider.com': 'news',
  'techcrunch.com': 'news',
  'theverge.com': 'news',
  'wired.com': 'news',
  'arstechnica.com': 'news',
  'engadget.com': 'news',
  'mashable.com': 'news',
  'gizmodo.com': 'news',
  'cnet.com': 'news',
  'zdnet.com': 'news',
  'venturebeat.com': 'news',
  'thenextweb.com': 'news',
  'news.ycombinator.com': 'news',
  'slashdot.org': 'news',
  'drudgereport.com': 'news',
  'npr.org': 'news',
  'pbs.org': 'news',
  'aljazeera.com': 'news',
  'rt.com': 'news',
  'france24.com': 'news',
  'dw.com': 'news',
  'scmp.com': 'news',

  // Shopping
  'amazon.com': 'shopping',
  'amazon.co.uk': 'shopping',
  'amazon.de': 'shopping',
  'amazon.ca': 'shopping',
  'ebay.com': 'shopping',
  'walmart.com': 'shopping',
  'target.com': 'shopping',
  'etsy.com': 'shopping',
  'aliexpress.com': 'shopping',
  'alibaba.com': 'shopping',
  'wish.com': 'shopping',
  'shopify.com': 'shopping',
  'bestbuy.com': 'shopping',
  'costco.com': 'shopping',
  'homedepot.com': 'shopping',
  'lowes.com': 'shopping',
  'ikea.com': 'shopping',
  'wayfair.com': 'shopping',
  'overstock.com': 'shopping',
  'newegg.com': 'shopping',
  'bhphotovideo.com': 'shopping',
  'zappos.com': 'shopping',
  'nordstrom.com': 'shopping',
  'macys.com': 'shopping',
  'kohls.com': 'shopping',
  'jcpenney.com': 'shopping',
  'sephora.com': 'shopping',
  'ulta.com': 'shopping',
  'nike.com': 'shopping',
  'adidas.com': 'shopping',
  'gap.com': 'shopping',
  'hm.com': 'shopping',
  'zara.com': 'shopping',
  'uniqlo.com': 'shopping',
  'asos.com': 'shopping',
  'shein.com': 'shopping',
  'chewy.com': 'shopping',
  'petco.com': 'shopping',
  'petsmart.com': 'shopping',
  'instacart.com': 'shopping',
  'doordash.com': 'shopping',
  'ubereats.com': 'shopping',
  'grubhub.com': 'shopping',
  'postmates.com': 'shopping',

  // Development
  'github.com': 'development',
  'gitlab.com': 'development',
  'bitbucket.org': 'development',
  'stackoverflow.com': 'development',
  'stackexchange.com': 'development',
  'npmjs.com': 'development',
  'pypi.org': 'development',
  'rubygems.org': 'development',
  'crates.io': 'development',
  'packagist.org': 'development',
  'maven.apache.org': 'development',
  'nuget.org': 'development',
  'hub.docker.com': 'development',
  'vercel.com': 'development',
  'netlify.com': 'development',
  'heroku.com': 'development',
  'railway.app': 'development',
  'render.com': 'development',
  'fly.io': 'development',
  'digitalocean.com': 'development',
  'aws.amazon.com': 'development',
  'console.aws.amazon.com': 'development',
  'cloud.google.com': 'development',
  'console.cloud.google.com': 'development',
  'azure.microsoft.com': 'development',
  'portal.azure.com': 'development',
  'cloudflare.com': 'development',
  'dash.cloudflare.com': 'development',
  'codepen.io': 'development',
  'codesandbox.io': 'development',
  'replit.com': 'development',
  'jsfiddle.net': 'development',
  'glitch.com': 'development',
  'dev.to': 'development',
  'medium.com': 'development',
  'hashnode.com': 'development',
  'devdocs.io': 'development',
  'mdn.io': 'development',
  'developer.mozilla.org': 'development',
  'w3schools.com': 'development',
  'freecodecamp.org': 'development',
  'leetcode.com': 'development',
  'hackerrank.com': 'development',
  'codewars.com': 'development',
  'exercism.org': 'development',
  'topcoder.com': 'development',
  'codeforces.com': 'development',
  'kaggle.com': 'development',
  'huggingface.co': 'development',
  'openai.com': 'development',
  'anthropic.com': 'development',
  'linear.app': 'development',
  'jira.atlassian.com': 'development',
  'atlassian.com': 'development',
  'postman.com': 'development',
  'swagger.io': 'development',
  'regex101.com': 'development',
  'json-generator.com': 'development',

  // Productivity
  'notion.so': 'productivity',
  'docs.google.com': 'productivity',
  'sheets.google.com': 'productivity',
  'slides.google.com': 'productivity',
  'drive.google.com': 'productivity',
  'calendar.google.com': 'productivity',
  'keep.google.com': 'productivity',
  'office.com': 'productivity',
  'office365.com': 'productivity',
  'onedrive.live.com': 'productivity',
  'sharepoint.com': 'productivity',
  'trello.com': 'productivity',
  'asana.com': 'productivity',
  'monday.com': 'productivity',
  'clickup.com': 'productivity',
  'basecamp.com': 'productivity',
  'airtable.com': 'productivity',
  'coda.io': 'productivity',
  'todoist.com': 'productivity',
  'ticktick.com': 'productivity',
  'any.do': 'productivity',
  'evernote.com': 'productivity',
  'onenote.com': 'productivity',
  'bear.app': 'productivity',
  'craft.do': 'productivity',
  'obsidian.md': 'productivity',
  'roamresearch.com': 'productivity',
  'logseq.com': 'productivity',
  'figma.com': 'productivity',
  'sketch.com': 'productivity',
  'canva.com': 'productivity',
  'miro.com': 'productivity',
  'lucidchart.com': 'productivity',
  'whimsical.com': 'productivity',
  'excalidraw.com': 'productivity',
  'loom.com': 'productivity',
  'calendly.com': 'productivity',
  'doodle.com': 'productivity',
  'typeform.com': 'productivity',
  'surveymonkey.com': 'productivity',
  'dropbox.com': 'productivity',
  'box.com': 'productivity',
  'wetransfer.com': 'productivity',
  '1password.com': 'productivity',
  'lastpass.com': 'productivity',
  'bitwarden.com': 'productivity',
  'dashlane.com': 'productivity',
  'grammarly.com': 'productivity',
  'hemingwayapp.com': 'productivity',
  'otter.ai': 'productivity',
  'zapier.com': 'productivity',
  'ifttt.com': 'productivity',
  'make.com': 'productivity',
  'n8n.io': 'productivity',

  // Communication
  'gmail.com': 'communication',
  'mail.google.com': 'communication',
  'outlook.com': 'communication',
  'outlook.live.com': 'communication',
  'outlook.office.com': 'communication',
  'yahoo.com': 'communication',
  'mail.yahoo.com': 'communication',
  'proton.me': 'communication',
  'protonmail.com': 'communication',
  'icloud.com': 'communication',
  'aol.com': 'communication',
  'zoho.com': 'communication',
  'fastmail.com': 'communication',
  'hey.com': 'communication',
  'slack.com': 'communication',
  'teams.microsoft.com': 'communication',
  'zoom.us': 'communication',
  'meet.google.com': 'communication',
  'webex.com': 'communication',
  'gotomeeting.com': 'communication',
  'whereby.com': 'communication',
  'around.co': 'communication',
  'gather.town': 'communication',
  'telegram.org': 'communication',
  'web.telegram.org': 'communication',
  'whatsapp.com': 'communication',
  'web.whatsapp.com': 'communication',
  'messenger.com': 'communication',
  'signal.org': 'communication',
  'skype.com': 'communication',
  'viber.com': 'communication',
  'line.me': 'communication',
  'wechat.com': 'communication',
  'intercom.com': 'communication',
  'zendesk.com': 'communication',
  'freshdesk.com': 'communication',
  'crisp.chat': 'communication',
  'drift.com': 'communication',
  'hubspot.com': 'communication',
  'mailchimp.com': 'communication',
  'sendgrid.com': 'communication',
  'constantcontact.com': 'communication',

  // Education
  'coursera.org': 'education',
  'udemy.com': 'education',
  'edx.org': 'education',
  'khanacademy.org': 'education',
  'skillshare.com': 'education',
  'linkedin.com/learning': 'education',
  'pluralsight.com': 'education',
  'udacity.com': 'education',
  'codecademy.com': 'education',
  'treehouse.com': 'education',
  'datacamp.com': 'education',
  'brilliant.org': 'education',
  'masterclass.com': 'education',
  'domestika.org': 'education',
  'futurelearn.com': 'education',
  'class-central.com': 'education',
  'mit.edu': 'education',
  'stanford.edu': 'education',
  'harvard.edu': 'education',
  'yale.edu': 'education',
  'berkeley.edu': 'education',
  'ox.ac.uk': 'education',
  'cam.ac.uk': 'education',
  'wikipedia.org': 'education',
  'en.wikipedia.org': 'education',
  'britannica.com': 'education',
  'scholarpedia.org': 'education',
  'ted.com': 'education',
  'duolingo.com': 'education',
  'babbel.com': 'education',
  'rosettastone.com': 'education',
  'busuu.com': 'education',
  'memrise.com': 'education',
  'anki.net': 'education',
  'quizlet.com': 'education',
  'brainly.com': 'education',
  'chegg.com': 'education',
  'studocu.com': 'education',
  'sparknotes.com': 'education',
  'cliffsnotes.com': 'education',
  'wolframalpha.com': 'education',
  'symbolab.com': 'education',
  'desmos.com': 'education',
  'geogebra.org': 'education',
  'mathway.com': 'education',
  'photomath.com': 'education',
  'gradeup.co': 'education',
  'unacademy.com': 'education',
  'byjus.com': 'education',
  'vedantu.com': 'education',
};

// Get category for a domain (checks user overrides first, then defaults)
// Returns category ID (can be built-in SiteCategory or custom category UUID)
export function getCategoryForDomain(
  domain: string,
  userOverrides: Record<string, string>
): string {
  // Normalize domain (remove www prefix)
  const normalizedDomain = domain.replace(/^www\./, '');

  // Check user overrides first
  if (userOverrides[normalizedDomain]) {
    return userOverrides[normalizedDomain];
  }
  if (userOverrides[domain]) {
    return userOverrides[domain];
  }

  // Check default mappings
  if (DEFAULT_DOMAIN_CATEGORIES[normalizedDomain]) {
    return DEFAULT_DOMAIN_CATEGORIES[normalizedDomain];
  }
  if (DEFAULT_DOMAIN_CATEGORIES[domain]) {
    return DEFAULT_DOMAIN_CATEGORIES[domain];
  }

  // Return 'other' for uncategorized domains
  return 'other';
}

// Get all domains that belong to a category
export function getDomainsForCategory(
  category: string,
  userOverrides: Record<string, string>
): string[] {
  const domains: string[] = [];

  // From defaults (only for built-in categories)
  if (isBuiltInCategory(category)) {
    for (const [domain, cat] of Object.entries(DEFAULT_DOMAIN_CATEGORIES)) {
      if (cat === category && !userOverrides[domain]) {
        domains.push(domain);
      }
    }
  }

  // From user overrides
  for (const [domain, cat] of Object.entries(userOverrides)) {
    if (cat === category) {
      domains.push(domain);
    }
  }

  return domains;
}
