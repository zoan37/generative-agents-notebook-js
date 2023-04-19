import { DateTime } from 'luxon';
import * as deepcopy from 'deepcopy';
import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';

function getHoursPassed(time: DateTime, refTime: DateTime): number {
  return time.diff(refTime, 'hours').hours;
}

/**
 * Retriever that combines embedding similarity with recency.
 */
class TimeWeightedVectorStoreRetriever {
  // The vectorstore to store documents and determine salience.
  vectorstore: VectorStore;

  // Keyword arguments to pass to the vectorstore similarity search.
  search_kwargs: { k: number } = { k: 100 };

  // The memory_stream of documents to search through.
  memory_stream: Document[] = [];

  // The exponential decay factor used as (1.0-decay_rate)**(hrs_passed).
  decay_rate: number = 0.01;

  // The maximum number of documents to retrieve in a given call.
  k: number = 4;

  // Other keys in the metadata to factor into the score, e.g. 'importance'.
  other_score_keys: string[] = [];

  // The salience to assign memories not retrieved from the vector store.
  default_salience: number | null = null;

  constructor(vectorstore: VectorStore) {
    this.vectorstore = vectorstore;
  }

  /** 
   * Return the combined score for a document.
   */
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

  /**
   * Return documents that are salient to the query.
   */
  async getSalientDocs(query: string): Promise<Record<number, [Document<Record<string, any>>, number]>> {
    // TODO: check if similaritySearchWithScore behaves like
    // similarity_search_with_relevance_scores in the Python version.
    const docs_and_scores = await this.vectorstore.similaritySearchWithScore(
      query,
      this.search_kwargs.k,
    );
    const results: Record<number, [Document, number]> = {};
    for (const [fetched_doc, relevance] of docs_and_scores) {
      const buffer_idx = fetched_doc.metadata.buffer_idx as number;
      const doc = this.memory_stream[buffer_idx];
      results[buffer_idx] = [doc, relevance];
    }
    return results;
  }

  /**
   * Return documents that are relevant to the query.
   */
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

    // Ensure frequently accessed memories aren't forgotten
    const currentTime2 = DateTime.local();
    for (const [doc] of rescoredDocs.slice(0, this.k)) {
      const bufferedDoc = this.memory_stream[doc.metadata.buffer_idx];
      bufferedDoc.metadata.last_accessed_at = currentTime2.toISO();
      result.push(bufferedDoc);
    }

    return result;
  }

  /**
   * Return documents that are relevant to the query.
   */
  async agetRelevantDocuments(query: string): Promise<Document[]> {
    throw new Error("Not implemented");
  }

  // Note: For some reason, the VectorStore addDocuments method returns Promise<void>,
  // but the Python equivalent returns List[str].
  /**
   * Add documents to vectorstore.
   */
  addDocuments(documents: Document[], current_time = DateTime.local()): Promise<void> {
    // Avoid mutating input documents
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
}

export { TimeWeightedVectorStoreRetriever };