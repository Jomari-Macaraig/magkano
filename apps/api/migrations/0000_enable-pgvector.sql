-- Custom migration: pgvector backs recipe_chunks.embedding.
CREATE EXTENSION IF NOT EXISTS vector;
