// @ts-check
"use strict"

import CID from "cids"
import { MultipartData } from "./multipart-data.js"

/**
 * @typedef {import('./client').Client} Client
 */
export class BlobService {
  /**
   * @param {Client} client
   */
  constructor(client) {
    this.client = client
  }

  /**
   *
   * @param {File & FileExt} file
   * @param {PutOptions} [options]
   *
   * @typedef {Object} PutOptions
   * @property {string} [chunker]
   * @property {0|1} [cidVersion]
   * @property {boolean} [enableShardingExperiment]
   * @property {string} [hashAlg]
   * @property {boolean} [onlyHash]
   * @property {boolean} [pin]
   * @property {boolean} [rawLeaves]
   * @property {boolean} [shardSplitThreshold]
   * @property {boolean} [trickle]
   * @property {boolean} [wrapWithDirectory]
   * @property {number} [timeout]
   * @property {AbortSignal} [signal]
   * @property {function({total:number, loaded:number}):void} [progress]
   *
   * @typedef {Object} FileExt
   * @property {string} [filepath]
   * @property {string} [webkitRelativePath]
   * @returns {Promise<AddedFile>}
   */
  async put(file, options = {}) {
    const [added] = await this.putAll([file], options)
    return added
  }

  /**
   *
   * @param {Array<File & FileExt>} files
   * @param {PutOptions} [options]
   * @returns {Promise<AddedFile []>}
   *
   * @typedef {Object} AddedFile
   * @property {CID} cid
   * @property {string} path
   * @property {number} size
   */
  async putAll(files, options = {}) {
    const searchParams = new URLSearchParams()
    searchParams.set("stream-channels", "true")
    const {
      chunker,
      cidVersion,
      hashAlg,
      onlyHash,
      pin,
      rawLeaves,
      trickle,
      wrapWithDirectory,
      timeout,
      signal,
      progress,
    } = options

    if (progress != null) {
      searchParams.set("progress", "true")
    }

    if (trickle != null) {
      searchParams.set("trickle", trickle.toString())
    }

    if (onlyHash != null) {
      searchParams.set("only-hash", onlyHash.toString())
    }

    if (wrapWithDirectory != null) {
      searchParams.set("wrap-with-directory", wrapWithDirectory.toString())
    }

    if (chunker) {
      searchParams.set("chunker", chunker)
    }

    if (pin != null) {
      searchParams.set("pin", pin.toString())
    }

    if (rawLeaves != null) {
      searchParams.set("raw-leaves", rawLeaves.toString())
    }

    if (cidVersion != null) {
      searchParams.set("cid-version", cidVersion.toString())
    }

    if (hashAlg) {
      searchParams.set("hashAlg", hashAlg)
    }

    const body = new MultipartData()

    for (const file of files) {
      body.append("file", file, {
        headers: lastModifiedHeaders(file),
      })
    }

    const response = await this.client.fetch("add", {
      method: "POST",
      body: body.toBlob(),
      searchParams,
      timeout,
      signal,
      progress,
    })

    if (response.ok) {
      const text = await response.text()
      return text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((data) => data.Hash != null)
        .map(decodeAddEntry)
    } else {
      throw new Error(response.statusText)
    }
  }
}

/**
 *
 * @param {AddData} data
 * @typedef {Object} AddData
 * @property {string} Hash
 * @property {string} Name
 * @property {string} Size
 * @property {number} Bytes
 */
const decodeAddEntry = (data) => {
  return {
    path: data.Name,
    size: parseInt(data.Size),
    cid: new CID(data.Hash),
  }
}

/**
 * @param {File} file
 */
const lastModifiedHeaders = (file) => {
  const ms = file.lastModified
  const secs = Math.floor(ms / 1000)
  const nsecs = (ms - secs * 1000) * 1000
  const headers = new Headers()
  headers.set("mtime", secs.toString())
  headers.set("mtime-nsecs", nsecs.toString())
  return headers
}
