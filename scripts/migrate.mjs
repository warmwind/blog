#!/usr/bin/env node

/**
 * Migration script: Jekyll _posts/ → Astro src/data/blog/
 *
 * Transforms front matter, filenames, and content.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const POSTS_DIR = join(import.meta.dirname, "..", "_posts");
const OUTPUT_DIR = join(import.meta.dirname, "..", "src", "data", "blog");

async function migrate() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(POSTS_DIR)).filter(
    f => f.endsWith(".md") || f.endsWith(".markdown")
  );

  console.log(`Found ${files.length} posts to migrate\n`);

  const urlMap = []; // Track old URL → new URL for verification

  for (const file of files) {
    const content = await readFile(join(POSTS_DIR, file), "utf-8");

    // Parse front matter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) {
      console.warn(`  SKIP: ${file} — no front matter found`);
      continue;
    }

    const rawFm = fmMatch[1];
    const body = fmMatch[2];

    // Extract front matter fields
    const fm = parseFrontMatter(rawFm);

    // Extract slug from filename: 2023-03-05-some-title.html.markdown → some-title
    const fnMatch = basename(file).match(
      /^(\d{4}-\d{2}-\d{2})-(.+?)\.html\.(?:md|markdown)$/
    );
    if (!fnMatch) {
      console.warn(`  SKIP: ${file} — unexpected filename pattern`);
      continue;
    }

    const dateStr = fnMatch[1];
    const slug = fnMatch[2];

    // Build new front matter
    const newFm = {
      title: fm.title,
      pubDatetime: `${dateStr}T00:00:00+08:00`,
      description: fm.title, // Use title as description
      tags: normalizeTags(fm.tags),
      category: fm.category || undefined,
      draft: fm.published === "false" ? true : undefined,
      slug,
    };

    // Transform body content
    let newBody = body;

    // Remove READMORE markers
    newBody = newBody.replace(/^READMORE\s*$/gm, "");

    // Fix internal links: /posts/xxx.html → /posts/xxx/
    newBody = newBody.replace(
      /\(https:\/\/www\.oscarjiang\.site\/posts\/([^)]+?)\.html\)/g,
      "(/posts/$1/)"
    );

    // Build output
    const outputFm = buildFrontMatter(newFm);
    const outputContent = `---\n${outputFm}---\n${newBody}`;
    const outputFile = `${slug}.md`;

    await writeFile(join(OUTPUT_DIR, outputFile), outputContent, "utf-8");

    const oldUrl = `/posts/${slug}/`;
    urlMap.push({ file, slug, oldUrl });

    console.log(`  ✓ ${file} → ${outputFile}`);
  }

  console.log(`\nMigrated ${urlMap.length} posts to ${OUTPUT_DIR}`);

  // Print URL map for verification
  console.log("\nURL mapping (all should be /posts/<slug>/):");
  for (const { slug, oldUrl } of urlMap) {
    console.log(`  ${oldUrl}`);
  }
}

function parseFrontMatter(raw) {
  const result = {};
  let currentKey = null;
  let inArray = false;

  for (const line of raw.split("\n")) {
    // Array item
    if (inArray && line.match(/^- /)) {
      result[currentKey].push(line.replace(/^- /, "").trim());
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      currentKey = key;
      const trimmed = value.trim();

      // Inline YAML array: [item1, item2] or ['item1', 'item2']
      const inlineArrayMatch = trimmed.match(/^\[(.+)\]$/);
      if (inlineArrayMatch) {
        result[key] = inlineArrayMatch[1]
          .split(",")
          .map(s => s.trim().replace(/^['"]|['"]$/g, ""));
        inArray = false;
      } else if (trimmed === "") {
        // Could be start of array or empty value
        result[key] = [];
        inArray = true;
      } else {
        result[key] = trimmed;
        inArray = false;
      }
    } else if (inArray && line.match(/^\s*-\s+/)) {
      result[currentKey].push(line.replace(/^\s*-\s+/, "").trim());
    } else {
      inArray = false;
    }
  }

  return result;
}

function normalizeTags(tags) {
  if (!tags) return ["others"];
  if (typeof tags === "string") return [tags];
  if (Array.isArray(tags) && tags.length === 0) return ["others"];
  return tags;
}

function buildFrontMatter(fm) {
  let out = "";
  out += `title: ${yamlStr(fm.title)}\n`;
  out += `pubDatetime: ${fm.pubDatetime}\n`;
  out += `description: ${yamlStr(fm.description)}\n`;
  out += `slug: ${fm.slug}\n`;

  if (fm.draft) {
    out += `draft: true\n`;
  }

  if (fm.category) {
    out += `category: ${fm.category}\n`;
  }

  if (fm.tags && fm.tags.length > 0) {
    out += `tags:\n`;
    for (const tag of fm.tags) {
      out += `  - ${tag}\n`;
    }
  }

  return out;
}

function yamlStr(s) {
  if (!s) return '""';
  // Quote if contains colons, special chars
  if (s.includes(":") || s.includes("#") || s.includes('"') || s.includes("'")) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
