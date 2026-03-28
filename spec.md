# Mijn Opslag

## Current State
The app uses blob-storage component but incorrectly passes `ExternalBlob` as `content: Blob` in FileMetadata directly to the backend actor. This causes `Invalid vec nat8 argument: {"_blob": {...}}` because the blob object is not a Uint8Array.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- Backend: `FileMetadata.content: Blob` → `FileMetadata.contentHash: Text` (store blob-storage hash reference, not raw bytes)
- Frontend upload flow: first upload file bytes via `StorageClient.putFile()` to get a hash, then call `actor.uploadFile()` with metadata + hash
- Frontend display: retrieve file URLs using `StorageClient.getDirectURL(hash)`

### Remove
- `content: Blob` field from backend FileMetadata
- ExternalBlob usage in upload mutation

## Implementation Plan
1. Regenerate Motoko backend with `contentHash: Text` in FileMetadata instead of `content: Blob`
2. Update frontend useUploadFile: use StorageClient.putFile() for actual bytes, then save metadata with returned hash
3. Update frontend file display: use StorageClient to get direct URL from contentHash
