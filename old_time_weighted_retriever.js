const deepcopy = require('deepcopy');
const { DateTime } = require('luxon');

class TimeWeightedVectorStoreRetriever {
  constructor(vectorstore, search_kwargs = { k: 100 }, memory_stream = [], decay_rate = 0.01, k = 4, other_score_keys = [], default_salience = null) {
    this.vectorstore = vectorstore;
    this.search_kwargs = search_kwargs;
    this.memory_stream = memory_stream;
    this.decay_rate = decay_rate;
    this.k = k;
    this.other_score_keys = other_score_keys;
    this.default_salience = default_salience;
  }

  _getHoursPassed(time, refTime) {
    return (time - refTime) / 3600000;
  }

  _getCombinedScore(document, vectorRelevance, currentTime) {
    const hoursPassed = this._getHoursPassed(currentTime, DateTime.fromISO(document.metadata.last_accessed_at));
    let score = Math.pow(1.0 - this.decay_rate, hoursPassed);
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

  getSalientDocs(query) {
    const docsAndScores = this.vectorstore.similarity_search_with_relevance_scores(query, this.search_kwargs);
    const results = {};
    for (const [fetchedDoc, relevance] of docsAndScores) {
      const bufferIdx = fetchedDoc.metadata.buffer_idx;
      const doc = this.memory_stream[bufferIdx];
      results[bufferIdx] = [doc, relevance];
    }
    return results;
  }

  getRelevantDocuments(query) {
    const currentTime = DateTime.local();
    const docsAndScores = this.memory_stream.slice(-this.k).reduce((acc, doc) => {
      acc[doc.metadata.buffer_idx] = [doc, this.default_salience];
      return acc;
    }, {});
    Object.assign(docsAndScores, this.getSalientDocs(query));
    const rescoredDocs = Object.values(docsAndScores).map(([doc, relevance]) => [doc, this._getCombinedScore(doc, relevance, currentTime)]);
    rescoredDocs.sort((a, b) => b[1] - a[1]);
    const result = [];
    const updateTime = DateTime.local();
    for (const [doc] of rescoredDocs.slice(0, this.k)) {
      const bufferedDoc = this.memory_stream[doc.metadata.buffer_idx];
      bufferedDoc.metadata.last_accessed_at = updateTime.toISO();
      result.push(bufferedDoc);
    }
    return result;
  }

  async agetRelevantDocuments(query) {
    throw new Error('NotImplementedError');
  }

  addDocuments(documents, { current_time = DateTime.local() } = {}) {
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

  async aaddDocuments(documents, { current_time = DateTime.local() } = {}) {
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