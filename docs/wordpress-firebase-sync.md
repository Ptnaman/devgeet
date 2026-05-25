# WordPress to Firebase Sync Setup

## Goal
- Keep WordPress as the editing source.
- Mirror posts and categories into Firebase Firestore.
- Let the app read from Firestore in realtime.

## Current App Behavior
- The app already reads published posts from Firestore `posts`.
- Any synced post with `status: "published"` automatically appears in app lists.

## 1. Configure Sync Secret
- Add environment variables in `functions/.env`:

```env
WORDPRESS_SYNC_SECRET=replace-with-long-random-string
WORDPRESS_SITE_URL=https://devgeet.com
```

- The Cloud Function validates this secret from header `x-sync-secret`.

## 2. Deploy Firebase Functions
- Deploy from project root:

```bash
firebase deploy --only functions
```

- After deploy, copy function URL for `syncWordpressContent`:
`https://us-central1-<project-id>.cloudfunctions.net/syncWordpressContent`

## 3. Install WordPress Sync Plugin
- Create `wp-content/plugins/devgeet-firebase-sync/devgeet-firebase-sync.php`.
- Paste this code and update endpoint + secret.

```php
<?php
/**
 * Plugin Name: DevGeet Firebase Sync
 * Description: Sync WordPress posts/categories to Firebase Firestore.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

define('DEVGEET_FIREBASE_SYNC_ENDPOINT', 'https://us-central1-<project-id>.cloudfunctions.net/syncWordpressContent');
define('DEVGEET_FIREBASE_SYNC_SECRET', 'replace-with-same-secret');

function devgeet_firebase_sync_send($body) {
  wp_remote_post(DEVGEET_FIREBASE_SYNC_ENDPOINT, [
    'timeout' => 20,
    'headers' => [
      'Content-Type' => 'application/json',
      'x-sync-secret' => DEVGEET_FIREBASE_SYNC_SECRET,
    ],
    'body' => wp_json_encode($body),
  ]);
}

function devgeet_firebase_post_payload($post_id) {
  $post = get_post($post_id);
  if (!$post) return null;

  $categories = wp_get_post_categories($post_id, ['fields' => 'all']);
  $category_items = [];
  foreach ($categories as $cat) {
    $category_items[] = [
      'id' => (string) $cat->term_id,
      'name' => (string) $cat->name,
      'slug' => (string) $cat->slug,
    ];
  }

  $author_id = (int) $post->post_author;
  $author = get_userdata($author_id);

  return [
    'entityType' => 'post',
    'operation' => 'upsert',
    'payload' => [
      'id' => (string) $post_id,
      'slug' => (string) $post->post_name,
      'title' => (string) $post->post_title,
      'contentHtml' => (string) $post->post_content,
      'contentText' => wp_strip_all_tags((string) $post->post_content),
      'excerpt' => (string) $post->post_excerpt,
      'status' => (string) $post->post_status,
      'date' => (string) $post->post_date_gmt,
      'modified' => (string) $post->post_modified_gmt,
      'publishedAt' => (string) $post->post_date_gmt,
      'featureImageUrl' => (string) (get_the_post_thumbnail_url($post_id, 'full') ?: ''),
      'authorId' => (string) $author_id,
      'authorDisplayName' => $author ? (string) $author->display_name : '',
      'authorUsername' => $author ? (string) $author->user_login : '',
      'authorEmail' => $author ? (string) $author->user_email : '',
      'categories' => $category_items,
    ],
  ];
}

add_action('save_post_post', function($post_id, $post, $update) {
  if (wp_is_post_revision($post_id) || (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)) return;
  if (!$post || $post->post_type !== 'post') return;

  $payload = devgeet_firebase_post_payload($post_id);
  if ($payload) devgeet_firebase_sync_send($payload);
}, 20, 3);

add_action('before_delete_post', function($post_id) {
  $post = get_post($post_id);
  if (!$post || $post->post_type !== 'post') return;

  devgeet_firebase_sync_send([
    'entityType' => 'post',
    'operation' => 'delete',
    'payload' => [
      'id' => (string) $post_id,
      'hardDelete' => true,
    ],
  ]);
});

add_action('trashed_post', function($post_id) {
  $post = get_post($post_id);
  if (!$post || $post->post_type !== 'post') return;

  devgeet_firebase_sync_send([
    'entityType' => 'post',
    'operation' => 'delete',
    'payload' => [
      'id' => (string) $post_id,
      'hardDelete' => false,
    ],
  ]);
});

function devgeet_firebase_sync_category($term_id, $taxonomy, $operation = 'upsert', $deleted_term = null) {
  if ($taxonomy !== 'category') return;

  $term = $deleted_term ? $deleted_term : get_term($term_id, $taxonomy);
  if ($operation === 'delete' || !$term || is_wp_error($term)) {
    devgeet_firebase_sync_send([
      'entityType' => 'category',
      'operation' => 'delete',
      'payload' => [
        'id' => (string) $term_id,
        'slug' => ($deleted_term && isset($deleted_term->slug)) ? (string) $deleted_term->slug : '',
      ],
    ]);
    return;
  }

  devgeet_firebase_sync_send([
    'entityType' => 'category',
    'operation' => 'upsert',
    'payload' => [
      'id' => (string) $term->term_id,
      'slug' => (string) $term->slug,
      'name' => (string) $term->name,
    ],
  ]);
}

add_action('created_term', function($term_id, $tt_id, $taxonomy) {
  devgeet_firebase_sync_category($term_id, $taxonomy, 'upsert');
}, 20, 3);

add_action('edited_term', function($term_id, $tt_id, $taxonomy) {
  devgeet_firebase_sync_category($term_id, $taxonomy, 'upsert');
}, 20, 3);

add_action('delete_term', function($term_id, $tt_id, $taxonomy, $deleted_term) {
  devgeet_firebase_sync_category($term_id, $taxonomy, 'delete', $deleted_term);
}, 20, 4);
```

## 4. Backfill Old WordPress Posts
- Existing posts do not sync automatically unless re-saved.
- Run this one-time WP-CLI command on WordPress host:

```bash
wp post list --post_type=post --post_status=publish,draft,pending,future,private --format=ids | \
xargs -n 1 wp post update
```

- This triggers `save_post_post` and pushes each post.

## 4A. One-Time Direct Import From WordPress API
- If your WordPress already has old content, you can import directly without re-saving posts.
- Use deployed function URL:
`https://us-central1-<project-id>.cloudfunctions.net/importWordpressContent`

```bash
curl -X POST "https://us-central1-<project-id>.cloudfunctions.net/importWordpressContent" \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: <same-secret>" \
  -d '{"siteUrl":"https://devgeet.com"}'
```

- This imports:
  - All categories from `wp-json/wp/v2/categories`
  - Published posts from `wp-json/wp/v2/posts`

## 4B. Automatic Scheduled Pull Sync
- Function `syncWordpressContentFromSite` runs automatically every 6 hours.
- It pulls latest categories + published posts from `WORDPRESS_SITE_URL` (default `https://devgeet.com`).
- This keeps Firebase updated even if webhook/plugin trigger misses any update.

## 5. Firestore Data Mapping
- Synced `post` document id: WordPress post id.
- Main fields written by function:
  - `id`, `slug`, `title`, `content`, `contentHtml`
  - `featureImageUrl`, `youtubeVideoUrl`
  - `category`, `status`
  - `authorId`, `authorDisplayName`, `authorUsername`, `authorEmail`
  - `createDate`, `uploadDate`, `publishedAt`
- Synced `category` document id: normalized category slug.

## 6. Behavior Summary
- New post in WordPress:
  - Draft stays hidden in app.
  - Publish appears in app.
- Edit post in WordPress:
  - Firestore doc updates.
  - App receives updated data.
- Trash/Delete post:
  - Soft delete marks hidden or hard delete removes document.

## 7. Troubleshooting
- 401 response from function:
  - Secret mismatch between WordPress and Firebase function env.
- Post not visible in app:
  - Check `status` is mapped to `published`.
  - Check function logs for sync errors.
- Category tab missing category:
  - Ensure category sync hooks are enabled and categories exist in Firestore.
