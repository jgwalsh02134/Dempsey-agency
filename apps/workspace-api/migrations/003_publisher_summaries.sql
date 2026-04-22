-- 003_publisher_summaries.sql — cache of AI-generated publisher summaries.
-- Composite key (name, city, state) because publisher names are not globally
-- unique across the dataset (e.g. multiple "Unified Newspapers" in different
-- cities).

CREATE TABLE IF NOT EXISTS publisher_summaries (
  publisher_name  TEXT          NOT NULL,
  city            TEXT          NOT NULL,
  state           TEXT          NOT NULL,
  summary         TEXT          NOT NULL,
  generated_at    TIMESTAMPTZ   NOT NULL,
  model           TEXT          NOT NULL,
  PRIMARY KEY (publisher_name, city, state)
);
