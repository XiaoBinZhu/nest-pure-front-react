import { lambdaClient } from '@/libs/trpc/client';
import { type SemanticSearchSchemaType } from '@/types/rag';

import { knowledgeBaseService } from './knowledgeBase';

// 语义检索结果（映射到 LobeHub ChatSemanticSearchChunk 结构）
interface SearchHit {
  id: string;
  text: string | null;
  similarity: number;
  fileId: string | null;
  fileName: string | null;
}

// 汇总多个知识库的语义检索结果（G2 修复：对话内 @知识库检索从 tRPC mock 改为真实后端）
async function searchAllBases(params: SemanticSearchSchemaType): Promise<SearchHit[]> {
  const topK = params.topK ?? 5;
  let bases: Array<{ id: string; name?: string }> = [];
  if (params.knowledgeIds?.length) {
    bases = params.knowledgeIds.map((id) => ({ id }));
  } else {
    bases = await knowledgeBaseService.getKnowledgeBaseList();
  }
  if (!bases.length) return [];

  const hits: SearchHit[] = [];
  await Promise.all(
    bases.map(async (base) => {
      try {
        const rows = await knowledgeBaseService.search(base.id, params.query, topK);
        for (const row of rows || []) {
          hits.push({
            id: row.chunkId,
            text: row.content,
            similarity: Number(row.score) || 0,
            fileId: row.docId ?? null,
            fileName: row.docName ?? null,
          });
        }
      } catch (e) {
        console.warn('[rag] search base failed:', base.id, e);
      }
    }),
  );

  hits.sort((a, b) => b.similarity - a.similarity);
  return hits.slice(0, topK);
}

class RAGService {
  parseFileContent = async (id: string, skipExist?: boolean) => {
    return lambdaClient.document.parseFileContent.mutate({ id, skipExist });
  };

  createParseFileTask = async (id: string, skipExist?: boolean) => {
    return lambdaClient.chunk.createParseFileTask.mutate({ id, skipExist });
  };

  retryParseFile = async (id: string) => {
    return lambdaClient.chunk.retryParseFileTask.mutate({ id });
  };

  createEmbeddingChunksTask = async (id: string) => {
    return lambdaClient.chunk.createEmbeddingChunksTask.mutate({ id });
  };

  semanticSearch = async (query: string, fileIds?: string[]) => {
    return searchAllBases({ query, fileIds, topK: 5 });
  };

  semanticSearchForChat = async (params: SemanticSearchSchemaType, signal?: AbortSignal) => {
    // signal 透传：无 abort 语义（后端单次检索较快），保留参数签名
    void signal;
    return searchAllBases(params);
  };

  getFileContents = async (fileIds: string[], signal?: AbortSignal) => {
    return lambdaClient.chunk.getFileContents.mutate({ fileIds }, { signal });
  };

  deleteMessageRagQuery = async (id: string) => {
    return lambdaClient.message.removeMessageQuery.mutate({ id });
  };
}

export const ragService = new RAGService();
