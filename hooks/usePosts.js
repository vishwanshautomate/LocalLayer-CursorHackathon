import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MAP_RADIUS_METERS } from "@/lib/utils";

/** Stable reference — inline `{}` would be a new object every render and could retrigger subscriptions. */
const LIST_ALL_ARGS = {};

/** ~1.1 m — stabilizes Convex `listNearby` args so tiny float drift does not re-subscribe. */
function roundCoord(n) {
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Subscribes to Convex posts (nearby when GPS is known), create, upload, and signed read URLs for Groq.
 */
export function usePosts(pickLatLng) {
  const convex = useConvex();

  /** Only one of these runs: global list is skipped on the map when GPS is active to avoid double subscriptions and extra “refresh” churn from unrelated updates. */
  const allPosts = useQuery(api.posts.list, pickLatLng != null ? "skip" : LIST_ALL_ARGS);
  const nearbyArgs = useMemo(() => {
    if (pickLatLng == null) return "skip";
    return {
      lat: roundCoord(pickLatLng.lat),
      lng: roundCoord(pickLatLng.lng),
      radiusMeters: MAP_RADIUS_METERS,
    };
  }, [pickLatLng?.lat, pickLatLng?.lng]);

  const nearbyPosts = useQuery(api.posts.listNearby, nearbyArgs);

  const posts = useMemo(() => {
    if (pickLatLng != null) return nearbyPosts ?? [];
    return allPosts ?? [];
  }, [pickLatLng, nearbyPosts, allPosts]);

  const isLoading =
    pickLatLng != null ? nearbyPosts === undefined : allPosts === undefined;

  const createPost = useMutation(api.posts.create);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);

  const getStorageReadUrl = useCallback(
    async (storageId) => convex.query(api.posts.getStorageUrl, { storageId }),
    [convex],
  );

  return {
    posts,
    isLoading,
    createPost,
    generateUploadUrl,
    getStorageReadUrl,
  };
}
