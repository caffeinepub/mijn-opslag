import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileMetadata, UserProfile } from "../backend";
import type { ExternalBlob } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";
import { useStorageClient } from "./useStorageClient";

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

export type StoredFile = Omit<FileMetadata, "content"> & {
  content: ExternalBlob;
};

export function useGetFiles() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<StoredFile[]>({
    queryKey: ["files", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity) return [];
      const principal = identity.getPrincipal();
      const files = await actor.getFiles(principal);
      return files as unknown as StoredFile[];
    },
    enabled: !!actor && !actorFetching && !!identity,
  });
}

export function useUploadFile() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const storageClient = useStorageClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (pct: number) => void;
    }) => {
      if (!actor || !identity) throw new Error("Niet ingelogd");
      if (!storageClient) throw new Error("Opslag niet beschikbaar");

      const bytes = new Uint8Array(await file.arrayBuffer());
      const { hash } = await storageClient.putFile(bytes, onProgress);
      const content = new TextEncoder().encode(`!caf!${hash}`);

      const metadata: FileMetadata = {
        id: crypto.randomUUID(),
        content,
        name: file.name,
        size: BigInt(file.size),
        user: identity.getPrincipal(),
        description: "",
        uploadTime: BigInt(Date.now()) * BigInt(1_000_000),
      };

      await actor.uploadFile(metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useDeleteFile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not available");
      await actor.deleteFile(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}
