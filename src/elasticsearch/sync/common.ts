import { client } from "../connection";

export const getDocument = async (index: any, query: any) => {
  try {
    let document: any = await client.search({
      index: index,
      body: {
        query: query,
      },
    });
    if (
      document &&
      document.body &&
      document.body.hits &&
      document.body.hits.hits &&
      document.body.hits.hits[0] &&
      document.body.hits.hits[0]._source &&
      document.body.hits.hits[0]._id
    ) {
      return {
        _id: document.body.hits.hits[0]._id,
        _source: document.body.hits.hits[0]._source,
      };
    } else {
      return false;
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Performs a search using the provided query on the specified index and checks if any results exist.
 *
 * @param {any} query - The query to be used for the search.
 * @param {any} index - The index to search in.
 * @return {number} Returns 1 if results exist, 0 otherwise.
 */
export const checkIfAlreadyExists = async (query: any, index: any) => {
  try {
    // console.log('checkIfAlreadyExists', JSON.stringify(query));
    let result: any = await client.search({
      index: index,
      body: {
        query: query,
      },
    });
    // console.log('result', JSON.stringify(result));
    return result &&
      result.body &&
      result.body.hits &&
      result.body.hits.total &&
      result.body.hits.total.value &&
      result.body.hits.total.value > 0
      ? 1
      : 0;
  } catch (error: any) {
    console.error("here error checkIfAlreadyExists", error);
    throw error;
  }
};

export const documentExists = async (index: any, query: any) => {
  try {
    const document: any = await client.search({
      index: index,
      body: {
        query: query,
      },
    });
    if (
      document?.body?.hits?.hits?.[0]?._id &&
      document?.body?.hits?.hits?.[0]?._source
    ) {
      return {
        success: true,
        _id: document.body.hits.hits[0]._id,
        _source: document.body.hits.hits[0]._source,
      };
    } else {
      return {
        success: false,
      };
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Indexes a document into a specified index.
 *
 * @param {any} document - The document to be indexed.
 * @param {any} index - The index where the document will be stored.
 * @return {Promise<any>} The result of indexing the document.
 */
export const indexDocument = async (document: any, index: any) => {
  try {
    return await client.index({
      index: index,
      body: document,
      timeout: "5m",
    });
  } catch (error: any) {
    throw error;
  }
};

export const updateDocument = async (index: any, id: any, updateData: any) => {
  try {
    return await client.update({
      index: index,
      id: id,
      retry_on_conflict: 3,
      body: {
        doc: updateData,
      },
      timeout: "5m",
    });
  } catch (error) {
    // console.log('error', error);
    throw error;
  }
};

export const findDocumentById = async (index: any, id: any) => {
  try {
    const { body: document } = await client.get({
      index: index,
      id: id,
    });

    if (document && document._source) {
      // console.log('Found document:', document);
      return document;
    } else {
      // console.log('Document not found.');
      return null;
    }
  } catch (error) {
    // console.error('Error finding document:', error);
    throw error;
  }
};

export const refreshIndex = async (index: string) => {
  try {
    return await client.indices.refresh({ index: index });
  } catch (error) {
    console.error("refreshIndex", error);
    throw error;
  }
};
