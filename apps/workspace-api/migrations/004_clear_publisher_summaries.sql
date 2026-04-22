-- 004_clear_publisher_summaries.sql — one-time wipe after the /summary
-- system prompt was migrated from single-paragraph to structured markdown
-- (four labeled sections). Cached entries from migration 003 are plain
-- paragraphs and would render without structure in the new markdown viewer.
-- Subsequent calls will regenerate and repopulate the cache.

DELETE FROM publisher_summaries;
