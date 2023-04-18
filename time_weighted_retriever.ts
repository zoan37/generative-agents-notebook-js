import { DateTime } from 'luxon';
import * as deepcopy from 'deepcopy';
import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';

function getHoursPassed(time: DateTime, refTime: DateTime): number {
  return (time.diff(refTime, 'hours').hours);
}

class TimeWeightedVectorStoreRetriever {
  vectorstore: VectorStore;
  search_kwargs: { k: number } = { k: 100 };
  memory_stream: Document[] = [];
  decay_rate: number = 0.01;
  k: number = 4;
  other_score_keys: string[] = [];
  default_salience: number | null = null;

  constructor(vectorstore: VectorStore) {
    this.vectorstore = vectorstore;
  }

  private getCombinedScore(document: Document, vectorRelevance: number | null, currentTime: DateTime): number {
    const hoursPassed = getHoursPassed(currentTime, DateTime.fromISO(document.metadata.last_accessed_at));
    let score = Math.pow((1.0 - this.decay_rate), hoursPassed);
    for (const key of this.other_score_keys) {
      if (document.metadata.hasOwnProperty(key)) {
        score += document.metadata[key];
      }
    }
    if (vectorRelevance !== null) {
      score += vectorRelevance;
    }
    return score;
  }

  getSalientDocs(query: string): { [buffer_idx: number]: [Document, number] } {
    // Replace with the actual implementation for your use case
    throw new Error("Not implemented");
  }

  getRelevantDocuments(query: string): Document[] {
    const currentTime = DateTime.local();
    const docsAndScores: { [buffer_idx: number]: [Document, number | null] } = {};
    for (const doc of this.memory_stream.slice(-this.k)) {
      docsAndScores[doc.metadata.buffer_idx] = [doc, this.default_salience];
    }

    // If a doc is considered salient, update the salience score
    Object.assign(docsAndScores, this.getSalientDocs(query));

    const rescoredDocs = Object.values(docsAndScores).map(([doc, relevance]) => {
      return [doc, this.getCombinedScore(doc, relevance, currentTime)] as [Document, number];
    });

    rescoredDocs.sort((a, b) => b[1] - a[1]);

    const result: Document[] = [];
    const currentTime2 = DateTime.local();
    for (const [doc] of rescoredDocs.slice(0, this.k)) {
      const bufferedDoc = this.memory_stream[doc.metadata.buffer_idx];
      bufferedDoc.metadata.last_accessed_at = currentTime2.toISO();
      result.push(bufferedDoc);
    }

    return result;
  }

  async agetRelevantDocuments(query: string): Promise<Document[]> {
    throw new Error("Not implemented");
  }

  // Note: For some reason, the VectorStore addDocuments method returns Promise<void>,
  // but the Python equivalent returns List[str].
  addDocuments(documents: Document[], current_time = DateTime.local()): Promise<void> {
    const dupDocs = documents.map(doc => deepcopy(doc));
    dupDocs.forEach((doc, i) => {
      if (!doc.metadata.hasOwnProperty('last_accessed_at')) {
        doc.metadata.last_accessed_at = current_time.toISO();
      }
      if (!doc.metadata.hasOwnProperty('created_at')) {
        doc.metadata.created_at = current_time.toISO();
      }
      doc.metadata.buffer_idx = this.memory_stream.length + i;
    });
    this.memory_stream.push(...dupDocs);
    return this.vectorstore.addDocuments(dupDocs);
  }

  async aaddDocuments(documents: Document[], current_time = DateTime.local()): Promise<void> {
    const dupDocs = documents.map(doc => deepcopy(doc));
    dupDocs.forEach((doc, i) => {
      if (!doc.metadata.hasOwnProperty('last_accessed_at')) {
        doc.metadata.last_accessed_at = current_time.toISO();
      }
      if (!doc.metadata.hasOwnProperty('created_at')) {
        doc.metadata.created_at = current_time.toISO();
      }
      doc.metadata.buffer_idx = this.memory_stream.length + i;
    });
    this.memory_stream.push(...dupDocs);
    return await this.vectorstore.aaddDocuments(dupDocs);
  }
}

export { TimeWeightedVectorStoreRetriever };